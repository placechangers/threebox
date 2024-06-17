#!/usr/local/bin/python3

import os

CULPRIT = 'node_modules/web-ifc/web-ifc-api-node.js'

STATE_READING = 0
STATE_STATIC = 1
STATE_DONE = 2

state = STATE_READING
current = None

TEMP = '/tmp/web-ifc-api-node.js'

with open(TEMP, 'w') as f:
    for line in open(CULPRIT):
        if state == STATE_READING:
            if 'static {' in line:
                state = STATE_STATIC
                current = (' ' * line.index('static {')) + 'static '
                continue
            f.write(line)
        elif state == STATE_STATIC:
            if 'this.' in line:
                current += line[line.index('this.') + 5:]
                state = STATE_DONE
        elif state == STATE_DONE:
            f.write(current)
            state = STATE_READING

os.rename(TEMP, CULPRIT)
