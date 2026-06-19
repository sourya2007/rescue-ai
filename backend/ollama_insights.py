import ollama
import json

def generate_transcript_insights(structured_transcript):
    """
    Accepts the aligned text output from your Whisper + Pyannote pipeline
    and processes it locally with an LLM for advanced insights.
    """
    print("\n[Insights Engine] Querying local LLM (llama3.2:3b) for analysis...")
    
    # Format the array data into a readable conversational string block for the LLM
    formatted_transcript = ""
    for entry in structured_transcript:
        formatted_transcript += f"{entry['speaker']}: {entry['text']}\n"
        
    system_prompt = (
        "You are an advanced conversation analytics engine. Analyze the provided 911 call transcript "
        "and return a concise summary containing: \n"
        "1. Executive Summary: A 2-sentence overview of the discussion.\n"
        "2. Action Items: Bullet points of explicit commitments or tasks assigned to specific speakers.\n"
        "3. Speaker Dynamics: A quick note on who led the conversation and the overall sentiment."
    )
    
    try:
        response = ollama.chat(
            model='llama3.2:3b',
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': f"Here is the transcript:\n\n{formatted_transcript}"}
            ]
        )
        
        print("\n==============================================")
        print("          LOCAL AI ENGINE INSIGHTS           ")
        print("==============================================")
        print(response['message']['content'])
        print("==============================================\n")
        
        return response['message']['content']
        
    except Exception as e:
        print(f"Failed to query local LLM engine: {e}")
        return None

def label_speaker_roles(diarization_output):
    """
    Analyzes the transcript contextually and assigns roles ('911 DISPATCHER' or 'SPEAKER')
    to each segment by index. This ensures high accuracy even if diarization IDs are merged.
    """
    if not diarization_output:
        return diarization_output

    print("[Insights Engine] Categorizing speaker roles segment-by-segment via Llama 3.2...")
    
    # We pass the conversation with indices so the LLM can label each turn independently
    conversation_indexed = ""
    for i, entry in enumerate(diarization_output):
        # We still show the ID (e.g. SPEAKER_00) to help the LLM identify consistency
        conversation_indexed += f"[{i}] {entry['speaker']}: {entry['text']}\n"

    system_prompt = (
        "You are an expert emergency radio communications analyst. Your goal is to identify the role for EACH segment in the provided transcript. "
        "\n\nROLES:"
        "\n1. '911 DISPATCHER': Asks for location, verifies unit numbers, uses codes (10-4, etc.), maintains a professional/command tone."
        "\n2. 'SPEAKER': The caller reporting an incident or a unit responding with situational info."
        "\n\nINSTRUCTIONS:"
        "\n- Analyze the text of each segment indexed by [i]."
        "\n- Return ONLY a JSON object where the keys are the string indices and values are the roles."
        "\n- Example format: {\"0\": \"911 DISPATCHER\", \"1\": \"SPEAKER\", \"2\": \"911 DISPATCHER\"}"
    )

    try:
        response = ollama.chat(
            model='llama3.2:3b',
            options={'temperature': 0}, # Maximize accuracy and consistency
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': f"Transcript to label:\n{conversation_indexed}"}
            ]
        )
        
        content = response['message']['content'].strip()
        
        # Robust JSON extraction to handle markdown or conversational filler from LLM
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        elif "{" in content:
            content = content[content.find("{"):content.rfind("}")+1]
            
        role_map = json.loads(content)
        
        # Apply the roles back to the segments by index
        for i in range(len(diarization_output)):
            idx = str(i)
            if idx in role_map:
                diarization_output[i]['speaker'] = role_map[idx]
            elif i in role_map: # Handle numeric keys
                diarization_output[i]['speaker'] = role_map[i]

        return diarization_output
    except Exception as e:
        print(f"[Insights Engine] Contextual role identification failed: {e}")
        return diarization_output

def generate_structured_intel(structured_transcript):
    """
    Uses Ollama to extract specific emergency metadata (location, hazards, type) 
    in a structured format for the tactical dashboard.
    """
    print("[Insights Engine] Extracting structured tactical intel via Llama 3.2...")
    
    formatted_transcript = ""
    for entry in structured_transcript:
        formatted_transcript += f"{entry['speaker']}: {entry['text']}\n"

    system_prompt = (
        "You are a tactical emergency dispatcher. Analyze the transcript and return ONLY a JSON object. "
        "The JSON must have these exact keys: \n"
        "1. 'type': One of [FIRE, MEDICAL, VEHICLE_CRASH, SECURITY, HAZMAT, COLLAPSE, UNKNOWN]\n"
        "2. 'confidence': A number 0-100\n"
        "3. 'location': A concise string of the incident location\n"
        "4. 'hazards': A list of strings identifying active threats\n"
        "5. 'urgency': One of [CRITICAL, HIGH, MEDIUM, LOW]\n"
        "6. 'casualties': A concise summary of injuries or entrapments\n"
        "7. 'tacticalAction': A list of 3-4 specific first-responder tasks.\n"
        "Return ONLY the JSON block, no conversational filler."
    )

    try:
        response = ollama.chat(
            model='llama3.2:3b',
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': f"Transcript:\n{formatted_transcript}"}
            ]
        )
        
        content = response['message']['content']
        # Basic cleanup in case LLM adds markdown blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        return json.loads(content)
        
    except Exception as e:
        print(f"Failed to extract structured intel: {e}")
        return None

# --- Example Mock Testing Block ---
if __name__ == "__main__":
    # Mock data structure matching what your pipeline generates
    mock_pipeline_output = [
        {"speaker": "SPEAKER_00", "text": "We need to finish the frontend landing page layout by Friday night."},
        {"speaker": "SPEAKER_01", "text": "I can handle the UI styling, but I will need the cleaned backend data structure first."},
        {"speaker": "SPEAKER_00", "text": "Perfect. I am standardizing the audio processing backend arrays tonight."}
    ]
    
    generate_transcript_insights(mock_pipeline_output)
