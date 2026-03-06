import json
import os
import tempfile
import re
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_google_genai import ChatGoogleGenerativeAI

from langchain_core.prompts import PromptTemplate

router = APIRouter(tags=["Documents"])

@router.post("/generate-quiz")
async def generate_quiz(
    file: UploadFile = File(...),
    num_questions: str = Form("5"),
    difficulty: str = Form("Intermediate")
):
    try:
        

# 🟢 New Quiz Generation Prompt
        quiz_prompt = PromptTemplate.from_template(
            """You are an expert professor and the lead AI for StudyBuddy. Your goal is to create a high-quality assessment based ONLY on the provided document.

            DOCUMENT CONTENT:
            {context}

            QUIZ SPECIFICATIONS:
            - Number of Questions: {num_questions}
            - Difficulty Level: {difficulty}
            - Format: {format} (e.g., mcq or open-ended)

            INSTRUCTIONS:
            1. Identify the most important concepts, definitions, and relationships in the text.
            2. Create questions that test deep understanding, not just word-for-word recall.
            3. For Multiple Choice (MCQ): Provide 4 plausible options where only one is clearly correct.
            4. For every question, include a 'hint' (a subtle clue) and a 'rationale' (an explanation of the correct answer).
            5. STICK TO JSON: Your entire response must be a single, valid JSON object.

            REQUIRED JSON SCHEMA:
            {{
            "title": "A descriptive title for the quiz",
            "questions": [
                {{
                "id": "generate-a-unique-id",
                "text": "The question text here",
                "type": "mcq",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correctAnswer": "Option A",
                "hint": "Think about the relationship between...",
                "rationale": "This is correct because the document states..."
                }}
            ]
            }}

            JSON OUTPUT:"""
        )
        # 1. Load the full text (Bypass pgvector for Quiz to get full context)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        loader = PyPDFLoader(temp_file_path)
        docs = loader.load()
        full_text = "\n".join([d.page_content for d in docs])

        # 2. Initialize Gemini 1.5 Flash (Free Tier)
        llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash", 
            temperature=0.2 # Lower temperature = more factual questions
        )

        # 3. Format the prompt and invoke
        formatted_prompt = quiz_prompt.format(
            context=full_text,
            num_questions=num_questions,
            difficulty=difficulty,
            format="mcq"
        )

        # 🟢 Use .invoke() to get the JSON response
        response = await llm.ainvoke(formatted_prompt)
        raw_content = response.content
        json_str = re.sub(r"```json\n?|```", "", raw_content).strip()

        quiz_data = json.loads(json_str)
        # Cleanup
        os.remove(temp_file_path)

        # Return the content (ensure your frontend parses the string into JSON)
        return {
        "status": "success",
        "data": quiz_data
    }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))