import os
import time
import signal
import sys


def alarm_handler(signum, frame):
    print("\n⏰ ALARM RINGING! ⏰")
    sys.exit(0)


def create_alarm_process(seconds, message):
    pid = os.fork()

# Child process
    if pid == 0:  
        time.sleep(seconds)
        print(f"\n⏰ REMINDER: {message} ⏰")
        os._exit(0)


def main():
    seconds = int(input("Enter time (in seconds): "))
    message = input("Enter reminder message: ")

    create_alarm_process(seconds, message)

    print("Alarm set successfully!")

    signal.signal(signal.SIGALRM, alarm_handler)

    # Parent waits so child can run
    while True:
        signal.pause()


if __name__ == "__main__":
    main()
