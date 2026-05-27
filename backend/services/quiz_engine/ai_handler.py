import json
import logging
import os
import re
from typing import Any, Dict, List

from langchain_core.exceptions import OutputParserException
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq
from utils.prompts import QUIZ_PROMPTS

logger = logging.getLogger(__name__)

class QuizAIHandler:
    @staticmethod
    async def generate_questions(context_text: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        try:
            template_str = QUIZ_PROMPTS["GENERATION_SYSTEM"]
            print("Parameters in generate questions:", params)
            variables = {
                "context": context_text,
                "num_questions": params.get("numQuestions"),
                "quiz_type": "mcq",
                "difficulty": params.get("difficulty")
            }
            
            return await QuizAIHandler._execute_langchain_call(
                template_str=template_str,
                input_variables=variables
            )
        except Exception as e:
            logger.error(f"Error in generate_questions handler: {str(e)}")
            raise e

    @staticmethod
    async def evaluate_text_answers(questions_and_answers: List[Dict[str, Any]], context_text: str) -> List[Dict[str, Any]]:
        try:
            template_str = QUIZ_PROMPTS["EVALUATION_SYSTEM"]
            variables = {
                "context": context_text, 
                "submissions": json.dumps(questions_and_answers)
            }
            return await QuizAIHandler._execute_langchain_call(
                template_str=template_str,
                input_variables=variables
            )
        except Exception as e:
            logger.error(f"Error in evaluate_text_answers handler: {str(e)}")
            raise e

    @staticmethod
    async def _execute_langchain_call(template_str: str, input_variables: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Private helper executing the LangChain flow to get structured JSON."""
        try:
            llm = ChatGroq(
                model_name=os.getenv("MODAL_NAME"),
                temperature=0.2,
                groq_api_key=os.getenv("GROQ_API_KEY"),
                streaming=False ,
            )

            prompt = PromptTemplate.from_template(template_str)
            chain = prompt | llm
            response = await chain.ainvoke(input_variables)

            
            content = response.content.strip()
            match = re.search(r'\[.*\]', content, re.DOTALL)
        
            if match:
                json_str = match.group(0)
                return json.loads(json_str)
            else:
                logger.error(f"No JSON array found. Raw content: {content}")
                raise Exception("AI output did not contain a valid JSON array.")

        except OutputParserException as e:
            logger.error(f"LangChain Output Parsing Error: {str(e)}")
            raise Exception("Failed to parse AI output into structured data.")
        
        except json.JSONDecodeError as e:
            logger.error(f"Groq returned invalid JSON. Raw content: {content} - Error: {str(e)}")
            raise Exception("AI returned a non-JSON format.")
        
        except Exception as e:
            logger.error(f"Unexpected error in LangChain Groq execution: {str(e)}")
            raise e