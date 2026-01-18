import { NextResponse } from "next/server";

export async function GET() {
  const markdown = `# LiveLabs

Hands-on learning for technical teams. Learn by doing, not just watching.

LiveLabs provides guided, interactive training with real terminal environments.

## Features

### Real Terminals
Execute commands in live Docker environments. No simulations, just real hands-on practice.

### Guided Tracks
Step-by-step learning paths with automatic validation. Know exactly when you've mastered each concept.

### Team Management
Track your organization's progress. See who's completed training and identify knowledge gaps.

### Certificates
Generate verifiable completion certificates for compliance and professional development.

## How It Works

1. **Choose a Track** - Browse your organization's training catalog and enroll in learning tracks that match your goals.
2. **Follow the Guide** - Each step includes clear instructions, hints when you're stuck, and AI assistance for complex concepts.
3. **Practice in Terminal** - Execute real commands in your dedicated container. Setup scripts prepare your environment automatically.
4. **Validate and Progress** - Run validation scripts to check your work. Pass the check, unlock the next step, and track your progress.

## Built For

### Developer Onboarding
- Standardize onboarding across teams
- Get new hires productive faster
- Document institutional knowledge

### Compliance Training
- Verify hands-on security practices
- Generate audit-ready certificates
- Track completion organization-wide

### Skills Development
- Create custom learning paths
- Practice with real tools and environments
- Measure progress objectively

### Bootcamps & Education
- Scale interactive instruction
- Provide consistent lab environments
- Auto-grade student exercises

## Get Started

- [Register](/register)
- [Sign In](/login)
`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
