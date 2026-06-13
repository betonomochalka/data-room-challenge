import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

const metrics = [
  { label: 'Target price', value: '$99/mo', note: 'per business workspace' },
  { label: 'Break-even path', value: '102 customers', note: '$10k MRR baseline' },
  { label: '$1.2M valuation case', value: '100 customers', note: '$120k ARR at 10x ARR' },
  { label: 'Fastest wedge', value: 'Sales rooms', note: 'clinics, salons, agencies, brokers' },
];

const features = [
  {
    title: 'Unified deal room',
    description: 'A secure workspace where every lead gets files, notes, tasks, and follow-up context in one link.',
  },
  {
    title: 'AI follow-up briefs',
    description: 'Summaries of unread files, next steps, and missing documents so sales teams respond faster.',
  },
  {
    title: 'Client-ready proof',
    description: 'Signed URLs, access control, and previews turn the existing data room engine into a revenue product.',
  },
];

const launchSteps = [
  'Publish this page as the public offer and point cold outreach to /company.',
  'Sell 20 pilot accounts manually to local service businesses at $49-$99 per month.',
  'Turn the most repeated onboarding questions into in-app templates and AI prompts.',
  'Move annual contracts to $990 prepaid plans once retention is proven.',
];

export const Company: React.FC = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex max-w-7xl flex-col gap-12 px-6 py-10 lg:px-8 lg:py-16">
        <nav className="flex items-center justify-between">
          <Link to="/company" className="text-xl font-bold tracking-tight">
            LeadBox AI
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/login">Start pilot</Link>
            </Button>
          </div>
        </nav>

        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-7">
            <div className="inline-flex rounded-full border border-border px-4 py-2 text-sm text-muted-foreground">
              B2B SaaS company blueprint built on the existing data-room product
            </div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl">
                Turn every client conversation into a secure sales room.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                LeadBox AI packages secure file rooms, client links, and follow-up workflows for small businesses
                that close deals over chat but lose context across documents and messages.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/login">Launch the pilot</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#valuation">See the $1.2M model</a>
              </Button>
            </div>
          </div>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Investor-style one page plan</CardTitle>
              <CardDescription>Simple enough to sell today, specific enough to measure.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-border bg-background/40 p-4">
                  <div className="text-sm text-muted-foreground">{metric.label}</div>
                  <div className="mt-1 text-3xl font-bold">{metric.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{metric.note}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y border-border bg-card/30">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-12 lg:grid-cols-3 lg:px-8">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-background/60">
              <CardHeader>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="valuation" className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-2 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>$1.2M valuation target</CardTitle>
            <CardDescription>Revenue math for a practical SaaS seed case.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              100 paying workspaces at $99 per month creates $9,900 MRR, or $118,800 ARR. At a conservative
              10x ARR SaaS multiple, the company can defend a valuation near $1.2M.
            </p>
            <p>
              The wedge is not a broad messenger replacement. It is a focused sales-room layer for businesses
              that already use chat but need secure documents, repeatable handoff, and client trust.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution checklist</CardTitle>
            <CardDescription>What the operator does first.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-muted-foreground">
              {launchSteps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default Company;
