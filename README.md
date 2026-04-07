**Bachelor's Thesis (TFG) — Miguel Sánchez-Beato**

---

## Description

A web application that helps students of *Database Systems* to self-assess using a fine-tuned large language model (Llama 3). It uses docker-compose to get 4 dockers into 1 to make it easy to execute locally. Students can practise, receive instant feedback, and track their progress in an intuitive interface. Completelly documented in Spanish in TFG.pdf with every aspect relevant to the project, execution photos, evaluation of the effect of the finetuning, interface screencaptures of every relevant detail of the frontend and every detail considered relevant to the project. All the questions and application is in Spanish as it is a Bachelor's Thesis in a Spanish University and it is thought to be used by teachers of courses of Databases.

---

## Table of Contents

1. [Main Features](#main-features)
2. [Architecture](#architecture)
3. [Setup & Getting Started](#setup--getting-started)
   1. [Prerequisites](#1-prerequisites)
   2. [Clone the Repository](#2-clone-the-repository)
   3. [Download the Model](#3-download-the-model)
   4. [Start the Application](#4-start-the-application)
4. [User Manual](#user-manual)

---

## Main Features

- **Progress Dashboard**
  Visualise your overall progress, progress per learning objective, and the total number of questions answered, pending, and failed.

- **Learning Objective Evaluation**
  The app is structured around the course's learning objectives.

- **On-Demand Question Generation**
  Request new questions for specific acceptance criteria and the model will generate them for you.

- **Instant Feedback**
  Immediately know whether your answer is correct (🟢) or incorrect (🔴), along with a detailed explanation.

- **Attempt History**
  All your attempts are saved, allowing you to retry failed questions and track your evolution.

- **Intuitive Notifications**
  The system reports the status of operations (success, in progress, error) via a colour-coded scheme.

---

## Architecture

The system is composed of four Docker containers:

| Container | Technology | Port | Description |
|-----------|------------|------|-------------|
| `tfg-db` | MySQL 8.0 | 3306 | Relational database |
| `tfg-backend` | Node.js 20 | 9001 | REST API and business logic |
| `tfg-frontend` | Quasar SPA + NGINX | 9000 | User interface |
| `tfg-llm` | llama-cpp-python | 8000 | Fine-tuned Llama 3 model |

---

## Setup & Getting Started

### 1. Prerequisites

- **Docker Desktop** (v20.10 or higher)
- **Minimum 8 GB RAM**
- **Intel i7 7th generation processor or equivalent**
- **Internet connection** (first run only, to pull Docker images)

---

### 2. Clone the Repository

```bash
git clone https://github.com/Miguelsbdh/TFG.git
cd TFG
```

**Project structure:**

```
cliente/          # Quasar frontend
servidor/         # Node.js backend
docker-compose.yml
nginx.conf
tfg.sql           # Database schema + initial data
README.md
```

---

### 3. Download the Model

Download the fine-tuned Llama 3 model from Hugging Face and place it inside a `models/` folder in the project root:

```
TFG/
└── models/
    └── llama-3-finetuned-bases-de-datos-unsloth.Q5_K_M.gguf
```

📥 **Download link:**
[https://huggingface.co/Miguelsbdh/llama-3-finetuned-bases-de-datos/blob/main/llama-3-finetuned-bases-de-datos-unsloth.Q5_K_M.gguf](https://huggingface.co/Miguelsbdh/llama-3-finetuned-bases-de-datos/blob/main/llama-3-finetuned-bases-de-datos-unsloth.Q5_K_M.gguf)

---

### 4. Start the Application

```bash
docker compose up --build
```

This single command will:
- Start the MySQL database and load the schema and initial data automatically.
- Build and start the Node.js backend.
- Build the Quasar SPA and serve it with NGINX.
- Start the Llama 3 model server.

Once all services are running, open your browser at [http://localhost:9000](http://localhost:9000).

> **Note:** The first build may take several minutes as Docker pulls the base images and compiles the frontend.

---

## User Manual

1. **Home:**
   Access [http://localhost:9000](http://localhost:9000). You will see a dashboard with your progress.

2. **Select a learning objective:**
   Navigate to one of the learning objective pages.

3. **Explore user stories:**
   Expand a story to see its acceptance criteria and the number of available questions.

4. **Generate questions (optional):**
   If you want more questions, select the criteria and click *"Request more questions"*.
   *Generation takes around 2.5 minutes per criterion. A blue notification 🔵 will keep you informed.*

5. **Evaluate yourself:**
   Click *"Evaluate story"* to start a test.

6. **Answer and learn:**
   Select your answer and receive instant feedback.

7. **Review your results:**
   At the end of the test, you will see a summary of your performance.
