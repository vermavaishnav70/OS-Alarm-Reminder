#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

void set_alarm() {
}

void display_reminders() {
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