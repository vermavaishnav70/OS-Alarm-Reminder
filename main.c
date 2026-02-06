#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_REMINDERS 100
#define MAX_MESSAGE_LENGTH 256

typedef struct {
    int id;
    int hour;
    int minute;
    char message[MAX_MESSAGE_LENGTH];
    int is_active;
} Reminder;

Reminder reminders[MAX_REMINDERS];
int reminder_count = 0;

void set_alarm() {
    if (reminder_count >= MAX_REMINDERS) {
        printf("Maximum number of reminders reached!\n");
        return;
    }
    
    Reminder new_reminder;
    new_reminder.id = reminder_count + 1;
    new_reminder.is_active = 1;
    
    printf("Enter alarm hour (0-23): ");
    scanf("%d", &new_reminder.hour);
    
    if (new_reminder.hour < 0 || new_reminder.hour > 23) {
        printf("Invalid hour! Please enter a value between 0-23.\n");
        return;
    }
    
    printf("Enter alarm minute (0-59): ");
    scanf("%d", &new_reminder.minute);
    
    if (new_reminder.minute < 0 || new_reminder.minute > 59) {
        printf("Invalid minute! Please enter a value between 0-59.\n");
        return;
    }
    
    printf("Enter reminder message: ");
    getchar(); // Clear newline from buffer
    fgets(new_reminder.message, MAX_MESSAGE_LENGTH, stdin);
    new_reminder.message[strcspn(new_reminder.message, "\n")] = 0; // Remove trailing newline
    
    reminders[reminder_count] = new_reminder;
    reminder_count++;
    
    printf("Alarm set successfully! ID: %d, Time: %02d:%02d\n", 
           new_reminder.id, new_reminder.hour, new_reminder.minute);
}

void display_reminders() {
    if (reminder_count == 0) {
        printf("No reminders set.\n");
        return;
    }
    
    printf("\n========== Active Reminders ==========\n");
    printf("%-5s %-10s %-30s %-10s\n", "ID", "Time", "Message", "Status");
    printf("--------------------------------------\n");
    
    int active_count = 0;
    for (int i = 0; i < reminder_count; i++) {
        if (reminders[i].is_active) {
            printf("%-5d %02d:%02d     %-30s %-10s\n",
                   reminders[i].id,
                   reminders[i].hour,
                   reminders[i].minute,
                   reminders[i].message,
                   "Active");
            active_count++;
        }
    }
    
    if (active_count == 0) {
        printf("No active reminders.\n");
    } else {
        printf("--------------------------------------\n");
        printf("Total active reminders: %d\n", active_count);
    }
}

void delete_reminder() {
}

void snooze_alarm() {
}

int main() {
    printf("OS Alarm Reminder System\n");
    
    int choice;
    while (1) {
        printf("\n1. Set Alarm\n");
        printf("2. Display Reminders\n");
        printf("3. Delete Reminder\n");
        printf("4. Snooze Alarm\n");
        printf("5. Exit\n");
        printf("Enter your choice: ");
        scanf("%d", &choice);
        
        switch (choice) {
            case 1:
                set_alarm();
                break;
            case 2:
                display_reminders();
                break;
            case 3:
                delete_reminder();
                break;
            case 4:
                snooze_alarm();
                break;
            case 5:
                printf("Exiting...\n");
                exit(0);
            default:
                printf("Invalid choice!\n");
        }
    }
    
    return 0;
}
