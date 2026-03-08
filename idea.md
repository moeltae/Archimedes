# Archimedes
### An AI Principal Investigator for Distributed Scientific Discovery

## Short Blurb

**Archimedes** is an AI principal investigator that reads new scientific papers, proposes follow-up experiments, breaks them into modular lab tasks, and allows the community to vote and fund the most promising studies. Labs can volunteer to run specific experiment modules, and the AI coordinates the workflow, analyzes returned data, and generates a draft research report.

The goal is to demonstrate a future where **AI doesn't just read science — it helps run it.**

---

# Core Idea

Modern science suffers from three bottlenecks:

1. **Too many papers, too little follow-up experimentation**
2. **Fragmented lab expertise**
3. **Slow coordination of experiments**

Archimedes proposes a new loop:


paper
↓
AI extracts claim
↓
AI proposes follow-up experiment
↓
experiment decomposed into modules
↓
community votes / funds
↓
labs claim modules
↓
results uploaded
↓
AI analyzes data
↓
AI drafts research report


Archimedes acts as a **scientific orchestrator**, similar to how a PI coordinates research projects.

---

# Hackathon Scope (Important)

The hackathon build focuses on demonstrating **one working loop**:


paper → experiment proposal → modular study design → community voting


Execution of experiments will be **simulated for the demo**.

---

# Demo Flow (3–4 Minutes)

## 1. Upload a Scientific Paper
User uploads a biology paper PDF.

System extracts:

- title
- abstract
- key claim
- research gap

Example output:


Paper Summary
Topic: Neuronal regeneration

Key finding:
Compound X increases neurite outgrowth in vitro

Research gap:
No in vivo validation in animal models


---

## 2. AI Proposes a Follow-Up Study

User clicks:

**"Generate Follow-Up Experiment"**

AI outputs:


Hypothesis
Compound X improves functional recovery after spinal cord injury.

Proposed Study
Test compound X in a rodent spinal cord injury model.


---

## 3. AI Designs the Experiment Pipeline

Archimedes generates a structured experimental plan.


Study Design

In vitro neurite outgrowth assay

Rodent spinal cord injury surgery

Behavioral recovery testing

Histological axon tracing

Image-based quantification


This demonstrates **AI acting like a principal investigator**.

---

## 4. Experiment Decomposition

The system automatically breaks the study into modules.


Experiment Modules

Module A
Cell culture assay

Module B
Rodent surgery

Module C
Behavioral testing

Module D
Histology

Module E
Image analysis


These modules represent **tasks different labs could run**.

---

## 5. Community Voting

Experiments appear in a marketplace.


Experiment
Compound X spinal cord recovery

Funding goal
$25,000

Modules required
5 labs


Users can:

- vote
- pledge funding
- volunteer their lab for a module

---

## 6. Simulated Results (Demo Only)

Example results are uploaded.


Behavior improvement: +35%
Axon density increase: +22%

Conclusion
Compound X significantly improves recovery.


AI generates:

- result summary
- figures
- draft report

---

# System Architecture

## Frontend

Next.js  
Tailwind  
Vercel deploy

Pages:


/upload-paper
/experiment-proposal
/experiment-marketplace
/experiment-detail


---

## Backend

Simple API routes or server actions.

Endpoints:


POST /parse-paper
POST /generate-experiment
POST /decompose-experiment
GET /experiments
POST /vote


---

## Database (Supabase)

Tables:

### papers


id
title
abstract
claims
created_at


### experiments


id
paper_id
hypothesis
study_design
funding_goal
votes


### modules


id
experiment_id
module_name
description
status
assigned_lab


### votes


id
experiment_id
user_id
vote


---

# AI Stack

## Core reasoning
OpenAI model

Tasks:

- summarize papers
- extract claims
- generate hypotheses
- design experiments
- decompose modules

---

## Scientific validation (optional)

FutureHouse agents:

Crow / Falcon
- literature grounding

Owl
- novelty detection

---

# Example Prompt Templates

## Extract claims


Read this paper abstract and extract:

Key scientific claim

Experimental evidence

Unanswered research question


---

## Generate follow-up experiment


Given this scientific finding, propose a follow-up study.

Return:

hypothesis

experiment description

expected outcome


---

## Decompose experiment


Break the following study into modular tasks that different labs could perform.

Return modules with:

name

description

expertise required


---

# Demo Script

1. Upload paper
2. AI summarizes claim
3. Generate experiment
4. Show experiment pipeline
5. Show modular lab tasks
6. Show experiment marketplace
7. Reveal simulated results

Final line:

**"Today AI can read papers. Tomorrow AI will run the lab."**

---

# Stretch Goals (If Time Allows)

- AI-generated funding cost estimate
- lab signup interface
- automated figure generation
- AI-generated paper draft
- novelty check using literature tools

---

# Vision

Archimedes is the first step toward a future where:

- AI proposes scientific discoveries
- communities fund experiments
- distributed labs run studies
- AI analyzes results and writes papers

A world where **science runs faster because AI helps coordinate it.**