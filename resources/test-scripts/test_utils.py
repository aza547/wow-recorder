import datetime
import time

RETAIL_LOG_PATH = "C:/Program Files/World of Warcraft/_retail_/Logs" 
CLASSIC_LOG_PATH = "C:/Program Files/World of Warcraft/_classic_/Logs"

def replace_date(line):
    event_position = line.find("  ")
    line_no_ts = line[event_position:]
    new_date_string = datetime.datetime.now().strftime("%#m/%#d %H:%M:%S.%f")[:-3]
    retstr = new_date_string + line_no_ts;
    return retstr

def close_sleep_open(file, sec, path):
    file.close()
    time.sleep(sec)
    return open(path, "a", encoding="utf-8")
