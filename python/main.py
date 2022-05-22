# import threading
import argparse
from Watcher import Watcher
import threading

parser = argparse.ArgumentParser(description='Warcraft recorder python backend.')

parser.add_argument('--storage', type=str, required=True, metavar='<PATH>', help='path to directory for storing video and metadata')
parser.add_argument('--logs', type=str, required=True, metavar='<PATH>', help='path to World of Warcraft logs')
parser.add_argument('--size',  type=int, required=True, metavar='<NUMBER>', help='max storage videos may consume on disk in GB')

args = parser.parse_args()

cfg = {
  "video_storage": args.storage,
  "wow_logs": args.logs,
  "max_storage": args.size
}

# Create watcher object and start it in a thread.
watcher = Watcher(cfg)
threading.Thread(target=(watcher.watch)).start()

# Block till ready to exit.
input("Running, press any key to quit.\n")

# Ready to exit, stop thread.
watcher.stop_watching()
