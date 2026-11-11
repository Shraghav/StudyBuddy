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
            print("Parameters in generate questions:", params)

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
            logger.error(f"Error in generate_questions handler: {e}")
            raise

    # @staticmethod
    # async def evaluate_text_answers(questions_and_answers: list[dict[str, Any]], context_text: str) -> List[Dict[str, Any]]:
    #     try:
    #         template_str = QUIZ_PROMPTS["EVALUATION_SYSTEM"]
    #         variables = {
    #             "context": context_text, 
    #             "submissions": json.dumps(questions_and_answers)
    #         }
    #         return await QuizAIHandler._execute_langchain_call(
    #             template_str=template_str,
    #             input_variables=variables
    #         )
    #     except Exception as e:
    #         logger.error(f"Error in evaluate_text_answers handler: {e}")
    #         raise e

    @staticmethod
    async def _execute_langchain_call(template_str: str, input_variables: dict[str, Any]) -> list[dict[str, Any]]:
        """Private helper executing the LangChain flow to get structured JSON."""
        try:
            # Step 1: Initialize ChatGroq client with low temperature
            modal_name = os.getenv("MODAL_NAME") or ""
            groq_api_key = os.getenv("GROQ_API_KEY")
            llm = ChatGroq(
                model=modal_name,
                temperature=0.2,
                api_key=SecretStr(groq_api_key) if groq_api_key else None,
                streaming=False ,
            )

            # Step 2: Create prompt and invoke execution chain
            prompt = PromptTemplate.from_template(template_str)
            chain = prompt | llm
            response = await chain.ainvoke(input_variables)
            content = response.content.strip() # type: ignore

            # Step 3: Extract structured JSON array from response content using regex
            match = re.search(r'\[.*\]', content, re.DOTALL)
            assert match is not None
            json_str = match.group(0)

            # Step 4: Deserialize JSON payload into Python list
            return json.loads(json_str)
        except OutputParserException as e:
            logger.error(f"LangChain Output Parsing Error: {e}")
            raise 
        except json.JSONDecodeError as e:
            logger.error(f"Groq returned invalid JSON. Raw content: {content} - Error: {e}")
            raise 
        except Exception as e:
            logger.error(f"Unexpected error in LangChain Groq execution: {e}")
            raise 