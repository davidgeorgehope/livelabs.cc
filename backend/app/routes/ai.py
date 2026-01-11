"""AI-powered assistance endpoints using Claude API"""
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import anthropic

from .. import models, auth
from ..database import get_db

router = APIRouter(prefix="/ai", tags=["ai"])

# Initialize Anthropic client
client = None
def get_client():
    global client
    if client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service not configured"
            )
        client = anthropic.Anthropic(api_key=api_key)
    return client


# Request/Response schemas
class HelpRequest(BaseModel):
    step_instructions: str
    step_title: str
    error_output: Optional[str] = None
    question: Optional[str] = None


class HelpResponse(BaseModel):
    response: str
    suggestions: list[str] = []


class ExplainCodeRequest(BaseModel):
    code: str
    language: str = "bash"
    context: Optional[str] = None


class ExplainCodeResponse(BaseModel):
    explanation: str
    line_by_line: list[dict] = []


class GenerateInstructionsRequest(BaseModel):
    title: str
    bullet_points: list[str]
    track_context: Optional[str] = None


class GenerateInstructionsResponse(BaseModel):
    instructions_md: str


class GenerateValidationRequest(BaseModel):
    step_title: str
    expected_outcome: str
    setup_script: Optional[str] = None


class GenerateValidationResponse(BaseModel):
    validation_script: str
    hints: list[str] = []


class GenerateHintsRequest(BaseModel):
    step_title: str
    instructions: str
    validation_script: str


class GenerateHintsResponse(BaseModel):
    hints: list[str]


# Learner endpoints
@router.post("/help", response_model=HelpResponse)
def get_help(
    request: HelpRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get AI-powered help for a stuck learner"""
    try:
        ai_client = get_client()
    except HTTPException:
        raise

    # Build the prompt
    system_prompt = """You are a helpful learning assistant for a hands-on technical training platform.
Your goal is to help learners complete exercises without giving away the full answer.
Provide hints and guidance that help them learn, not just copy-paste solutions.
Be encouraging and supportive. Keep responses concise and actionable."""

    user_content = f"""The learner is working on a step titled "{request.step_title}".

Instructions for this step:
{request.step_instructions}
"""

    if request.error_output:
        user_content += f"""
The learner ran into this error:
```
{request.error_output}
```
Please explain what this error means and suggest how to fix it.
"""
    elif request.question:
        user_content += f"""
The learner asks: {request.question}
"""
    else:
        user_content += """
The learner is stuck and needs a hint to proceed.
"""

    try:
        message = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}]
        )

        response_text = message.content[0].text

        # Extract suggestions if the response contains a list
        suggestions = []
        lines = response_text.split('\n')
        for line in lines:
            if line.strip().startswith(('- ', '* ', '1.', '2.', '3.')):
                suggestion = line.strip().lstrip('-*0123456789. ')
                if len(suggestion) > 10:
                    suggestions.append(suggestion)

        return HelpResponse(
            response=response_text,
            suggestions=suggestions[:5]
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )


@router.post("/explain-code", response_model=ExplainCodeResponse)
def explain_code(
    request: ExplainCodeRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    """Explain a code snippet line by line"""
    try:
        ai_client = get_client()
    except HTTPException:
        raise

    system_prompt = """You are a code explanation assistant. Explain code clearly and concisely.
Provide a brief overview, then break down the code line by line.
Use simple language that beginners can understand."""

    user_content = f"""Explain this {request.language} code:

```{request.language}
{request.code}
```
"""
    if request.context:
        user_content += f"\nContext: {request.context}"

    user_content += """

Provide:
1. A brief overview (2-3 sentences)
2. Line-by-line explanation in this format:
   - Line X: explanation

Keep each explanation concise."""

    try:
        message = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}]
        )

        response_text = message.content[0].text

        # Parse line-by-line explanations
        line_explanations = []
        for line in response_text.split('\n'):
            if 'Line' in line and ':' in line:
                parts = line.split(':', 1)
                if len(parts) == 2:
                    line_explanations.append({
                        "line": parts[0].strip(),
                        "explanation": parts[1].strip()
                    })

        return ExplainCodeResponse(
            explanation=response_text,
            line_by_line=line_explanations
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )


# Author endpoints
@router.post("/generate-instructions", response_model=GenerateInstructionsResponse)
def generate_instructions(
    request: GenerateInstructionsRequest,
    current_user: models.User = Depends(auth.get_current_author)
):
    """Generate step instructions from bullet points"""
    try:
        ai_client = get_client()
    except HTTPException:
        raise

    system_prompt = """You are a technical writing assistant for creating hands-on learning content.
Generate clear, engaging step-by-step instructions in Markdown format.
Use headers, code blocks, and bullet points appropriately.
Instructions should be actionable and beginner-friendly."""

    user_content = f"""Create instructions for a step titled "{request.title}".

Key points to cover:
{chr(10).join(f"- {point}" for point in request.bullet_points)}
"""
    if request.track_context:
        user_content += f"\nTrack context: {request.track_context}"

    user_content += """

Generate Markdown instructions that include:
1. A brief introduction explaining what they'll learn
2. Clear step-by-step instructions
3. Any relevant code examples
4. Expected outcomes"""

    try:
        message = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}]
        )

        return GenerateInstructionsResponse(
            instructions_md=message.content[0].text
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )


@router.post("/generate-validation", response_model=GenerateValidationResponse)
def generate_validation(
    request: GenerateValidationRequest,
    current_user: models.User = Depends(auth.get_current_author)
):
    """Generate a validation script and hints"""
    try:
        ai_client = get_client()
    except HTTPException:
        raise

    system_prompt = """You are a script writing assistant for technical learning platforms.
Generate bash validation scripts that check if learners completed tasks correctly.
Scripts should exit 0 on success, non-zero on failure.
Include helpful echo statements for feedback."""

    user_content = f"""Create a validation script for a step titled "{request.step_title}".

Expected outcome: {request.expected_outcome}
"""
    if request.setup_script:
        user_content += f"""
Setup script for context:
```bash
{request.setup_script}
```
"""

    user_content += """

Generate:
1. A bash validation script (start with #!/bin/bash and set -e)
2. 2-3 progressive hints for learners who fail validation

Return the script in a code block and hints as a numbered list."""

    try:
        message = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}]
        )

        response_text = message.content[0].text

        # Extract script from code block
        script = ""
        in_code_block = False
        script_lines = []
        for line in response_text.split('\n'):
            if line.strip().startswith('```bash') or line.strip().startswith('```shell'):
                in_code_block = True
                continue
            elif line.strip() == '```' and in_code_block:
                in_code_block = False
                continue
            elif in_code_block:
                script_lines.append(line)

        script = '\n'.join(script_lines)

        # Extract hints
        hints = []
        for line in response_text.split('\n'):
            line = line.strip()
            if line and (line[0].isdigit() and '.' in line[:3]):
                hint_text = line.split('.', 1)[1].strip() if '.' in line else line
                if len(hint_text) > 10:
                    hints.append(hint_text)

        return GenerateValidationResponse(
            validation_script=script or "#!/bin/bash\nset -e\n\n# TODO: Add validation logic\nexit 0",
            hints=hints[:3]
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )


@router.post("/generate-hints", response_model=GenerateHintsResponse)
def generate_hints(
    request: GenerateHintsRequest,
    current_user: models.User = Depends(auth.get_current_author)
):
    """Generate progressive hints for a step"""
    try:
        ai_client = get_client()
    except HTTPException:
        raise

    system_prompt = """You are a learning content assistant. Generate progressive hints that guide learners without giving away the answer.
Hints should be ordered from least to most revealing.
The first hint should be subtle, the last should almost give away the answer."""

    user_content = f"""Create 3-4 progressive hints for a step titled "{request.step_title}".

Instructions:
{request.instructions}

Validation script (what's being checked):
```bash
{request.validation_script}
```

Generate hints that progressively help learners figure out what to do.
Format as a numbered list."""

    try:
        message = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}]
        )

        response_text = message.content[0].text

        # Extract hints from numbered list
        hints = []
        for line in response_text.split('\n'):
            line = line.strip()
            if line and (line[0].isdigit() and '.' in line[:3]):
                hint_text = line.split('.', 1)[1].strip() if '.' in line else line
                if len(hint_text) > 10:
                    hints.append(hint_text)

        return GenerateHintsResponse(hints=hints[:4])

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )
