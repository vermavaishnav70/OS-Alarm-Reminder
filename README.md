# 📌 Alarm and Reminder System (OS Project – Phase 1)

---

# 🧠 Project Overview

The **Alarm and Reminder System** is a Phase-1 Operating Systems project designed to simulate how an OS handles **time-based task scheduling and event triggering**.

This system allows users to set multiple reminders that trigger at specific times. The program continuously checks the system clock and executes reminders when their scheduled time arrives.

The goal is to demonstrate core OS concepts like scheduling, multitasking, and time management in a simplified environment.

---

# 🎯 Objectives

- Implement a basic alarm/reminder system  
- Simulate OS task scheduling  
- Use system time for event triggers  
- Support multiple reminders  
- Demonstrate background process behavior  

---

# 💡 Problem Relevance to Operating Systems

Operating systems constantly manage:

- Alarms  
- Notifications  
- Cron jobs  
- Timed background tasks  

This project mimics how an OS:

- Monitors time  
- Schedules tasks  
- Triggers events at the correct moment  

---

# ⚙️ Features

✅ Set multiple reminders  
✅ Time-based triggering  
✅ Continuous system clock monitoring  
✅ Console notification alerts  
✅ Modular code structure  

---

# 🧩 OS Concepts Demonstrated

| Feature | OS Concept |
|--------|-----------|
| System time checking | System Clock |
| Continuous loop | Task Scheduler |
| Sleep interval | CPU Time Slicing |
| Multiple reminders | Multitasking |
| Alert triggering | Event Handling |

---

# 🏗️ Code Structure

### 1️⃣ Reminder Manager
Stores and manages all reminders.

### 2️⃣ Scheduler
Continuously checks system time and triggers reminders.

### 3️⃣ Notifier
Displays reminder alerts to the user.

### 4️⃣ Input Handler
Takes reminder details from the user.

---

# ▶️ How to Compile and Run

### Compile
```bash
g++ alarm.cpp -o alarm
Run
bash
Copy code
./alarm
📝 Input Format
Time must be entered in 24-hour HH:MM:SS format.

Example:
makefile
Copy code
18:30:10
📌 Example Usage
yaml
Copy code
How many reminders? 1
Enter time: 18:45:00
Enter message: Attend meeting
Output when triggered:

yaml
Copy code
🔔 REMINDER: Attend meeting
🚀 Future Improvements (Phase 2 Ideas)
Multithreading for true concurrency

GUI-based interface

Persistent storage (file/database)

Recurring reminders

Priority-based scheduling

📚 Learning Outcomes
By completing this project, students understand:

How operating systems manage time-based tasks

Basic scheduling mechanisms

Background processing concepts

Modular system design
