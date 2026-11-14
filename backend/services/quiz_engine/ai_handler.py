import json
import logging
import os
import re
from typing import Any

from langchain_core.exceptions import OutputParserException
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq
from pydantic import SecretStr
from utils.prompts import QUIZ_PROMPTS

logger = logging.getLogger(__name__)

class QuizAIHandler:
    @staticmethod
    async def generate_questions(context_text: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        try:
            # Step 1: Load system generation prompt template
            template_str = QUIZ_PROMPTS["GENERATION_SYSTEM"]
            print(f"[QUIZ AI HANDLER] Generating questions: difficulty='{params.get('difficulty', 'Medium')}', requested_count={params.get('numQuestions', 5)}, context_size={len(context_text):,} chars")

            # Step 2: Assemble template input parameters
            variables = {
                "context": context_text,
                "num_questions": params.get("numQuestions"),
                "quiz_type": "mcq",
                "difficulty": params.get("difficulty")
            }

            # Step 3: Execute LangChain call and return parsed question records
            return await QuizAIHandler._execute_langchain_call(
                template_str=template_str,
                input_variables=variables
            )
        except Exception as e:
            print(f"[QUIZ AI HANDLER] ERROR in generate_questions: {e}")
            logger.error(f"Error in generate_questions handler: {e}")
            raise

    @staticmethod
    async def _execute_langchain_call(template_str: str, input_variables: dict[str, Any]) -> list[dict[str, Any]]:
        """Private helper executing the LangChain flow to get structured JSON."""
        try:
            # Step 1: Initialize ChatGroq client with low temperature
            modal_name = os.getenv("MODAL_NAME") or ""
            groq_api_key = os.getenv("GROQ_API_KEY")
            print(f"[QUIZ AI HANDLER] Connecting to ChatGroq (model='{modal_name}', temperature=0.2)...")
            llm = ChatGroq(
                model=modal_name,
                temperature=0.2,
                api_key=SecretStr(groq_api_key) if groq_api_key else None,
                streaming=False,
            )

            # Step 2: Create prompt and invoke execution chain
            prompt = PromptTemplate.from_template(template_str)
            chain = prompt | llm
            print(f"[QUIZ AI HANDLER] Invoking LLM chain with context prompt...")
            response = await chain.ainvoke(input_variables)
            content = str(response.content).strip()
            print(f"[QUIZ AI HANDLER] Received response from LLM ({len(content):,} characters). Parsing JSON payload...")

            # Step 3: Strip markdown fences if present
            content_clean = re.sub(r"^```(?:json)?\s*", "", content, flags=re.MULTILINE)
            content_clean = re.sub(r"\s*```$", "", content_clean, flags=re.MULTILINE).strip()

            # Extract structured JSON array from response content using regex
            match = re.search(r'\[.*\]', content_clean, re.DOTALL)
            if match:
                json_str = match.group(0)
            else:
                json_str = content_clean

            # Strip trailing commas inside arrays/objects
            json_str = re.sub(r',\s*\]', ']', json_str)
            json_str = re.sub(r',\s*\}', '}', json_str)

            # Step 4: Deserialize JSON payload into Python list
            parsed = json.loads(json_str)
            questions: list[dict[str, Any]] = []
            if isinstance(parsed, list):
                questions = parsed
            elif isinstance(parsed, dict) and "questions" in parsed and isinstance(parsed["questions"], list):
                questions = parsed["questions"]
            else:
                questions = [parsed]
            print(f"[QUIZ AI HANDLER] Successfully parsed {len(questions)} question objects from AI response")
            return questions
        except OutputParserException as e:
            print(f"[QUIZ AI HANDLER] Output Parser Error: {e}")
            logger.error(f"LangChain Output Parsing Error: {e}")
            raise 
        except json.JSONDecodeError as e:
            print(f"[QUIZ AI HANDLER] JSON Decode Error: {e}")
            logger.error(f"Groq returned invalid JSON. Raw content: {content} - Error: {e}")
            raise 
        except Exception as e:
            print(f"[QUIZ AI HANDLER] Unexpected Error during LLM chain execution: {e}")
            logger.error(f"Unexpected error in LangChain Groq execution: {e}")
            raise 