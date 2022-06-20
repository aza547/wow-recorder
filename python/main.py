# import threading
import argparse
from Watcher import Watcher
import threading
from SizeMonitor import SizeMonitor
import signal
import sys

# Quietly exit on SIGINT
def signal_handler(sig, frame):
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# Set up command line inputs.
parser = argparse.ArgumentParser(description='Warcraft recorder python backend.')

parser.add_argument('--storage', type=str, required=True, metavar='<PATH>', help='path to directory for storing video and metadata')
parser.add_argument('--logs', type=str, required=True, metavar='<PATH>', help='path to World of Warcraft logs')
parser.add_argument('--size',  type=int, required=True, metavar='<NUMBER>', help='max storage videos may consume on disk in GB')
parser.add_argument('--ffmpeg',  type=str, required=True, metavar='<PATH>', help='path to ffmpeg binary')

args = parser.parse_args()
print(args, flush=True)

# Config object built from command line arguments.
cfg = {
  "video_storage": args.storage,
  "wow_logs": args.logs,
  "max_storage": args.size,
  "ffmpeg_path": args.ffmpeg
}

# Run size monitor on start-up.
size_monitor = SizeMonitor(cfg)
size_monitor.run()

# Create watcher object and start it in a thread.
watcher = Watcher(cfg)
watcherThread = threading.Thread(target=(watcher.watch))
watcherThread.daemon = True
watcherThread.start()

# Block till ready to exit.
input("RUNNING, press any key to quit.\n")

# Ready to exit, stop thread.
watcher.stop_watching()
