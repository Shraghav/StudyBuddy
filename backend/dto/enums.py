from enum import Enum

class QuizStatus(str, Enum):
    setup = "setup"
    generating = "generating"
    active = "active"
    grading = "grading"
    completed = "completed"
    error = "error"