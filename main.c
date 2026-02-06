#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <signal.h>
#include "../include/alarm.h"

int main() {
    int seconds;
    char message[100];

    printf("Enter time (in seconds): ");
    scanf("%d", &seconds);

    printf("Enter reminder message: ");
    scanf(" %[^\n]", message);

    create_alarm_process(seconds, message);


    printf("Alarm set successfully!\n");

    // Parent waits so child can run
    while (1) {
        pause();
    }

    return 0;
}
void alarm_handler(int sig) {
    printf("\n⏰ ALARM RINGING! ⏰\n");
    exit(0);
}

void create_alarm_process(int seconds, char *message) {
    pid_t pid = fork();

    if (pid == 0) {
        sleep(seconds);
        printf("\n⏰ REMINDER: %s ⏰\n", message);
        exit(0);
    }
}

