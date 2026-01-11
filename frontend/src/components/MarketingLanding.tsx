"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen, Terminal, Users, Award, ArrowRight, CheckCircle } from "lucide-react";

export function MarketingLanding() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Hands-On Learning for{" "}
            <span className="text-primary">Technical Teams</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            LiveLabs provides guided, interactive training with real terminal environments.
            Your team learns by doing, not just watching.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Teams Choose LiveLabs
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Terminal className="h-8 w-8" />}
              title="Real Terminals"
              description="Execute commands in live Docker environments. No simulations, just real hands-on practice."
            />
            <FeatureCard
              icon={<BookOpen className="h-8 w-8" />}
              title="Guided Tracks"
              description="Step-by-step learning paths with automatic validation. Know exactly when you've mastered each concept."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8" />}
              title="Team Management"
              description="Track your organization's progress. See who's completed training and identify knowledge gaps."
            />
            <FeatureCard
              icon={<Award className="h-8 w-8" />}
              title="Certificates"
              description="Generate verifiable completion certificates for compliance and professional development."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="space-y-8">
            <StepItem
              number={1}
              title="Choose a Track"
              description="Browse your organization's training catalog and enroll in learning tracks that match your goals."
            />
            <StepItem
              number={2}
              title="Follow the Guide"
              description="Each step includes clear instructions, hints when you're stuck, and AI assistance for complex concepts."
            />
            <StepItem
              number={3}
              title="Practice in Terminal"
              description="Execute real commands in your dedicated container. Setup scripts prepare your environment automatically."
            />
            <StepItem
              number={4}
              title="Validate and Progress"
              description="Run validation scripts to check your work. Pass the check, unlock the next step, and track your progress."
            />
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Built For
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <UseCaseCard
              title="Developer Onboarding"
              items={[
                "Standardize onboarding across teams",
                "Get new hires productive faster",
                "Document institutional knowledge",
              ]}
            />
            <UseCaseCard
              title="Compliance Training"
              items={[
                "Verify hands-on security practices",
                "Generate audit-ready certificates",
                "Track completion organization-wide",
              ]}
            />
            <UseCaseCard
              title="Skills Development"
              items={[
                "Create custom learning paths",
                "Practice with real tools and environments",
                "Measure progress objectively",
              ]}
            />
            <UseCaseCard
              title="Bootcamps & Education"
              items={[
                "Scale interactive instruction",
                "Provide consistent lab environments",
                "Auto-grade student exercises",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Transform Your Training?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join organizations that trust LiveLabs for hands-on technical education.
          </p>
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Create Your Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-lg border bg-background">
      <div className="text-primary mb-4">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function StepItem({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function UseCaseCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="p-6 rounded-lg border bg-background">
      <h3 className="font-semibold text-lg mb-4">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
