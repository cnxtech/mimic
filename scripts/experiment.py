#!/usr/bin/python

# ------------------------------------------------------------------------------
#
# Run experiment
#
# Author: Stefan Heule <sheule@cs.stanford.edu>
#
# ------------------------------------------------------------------------------

import sys
import os
import time
import argparse
import json
import threading
import subprocess
import shutil
import re

# ------------------------------------------
# main entry point
# ------------------------------------------

def get_time():
  return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

def main():
  parser = argparse.ArgumentParser(description='Run synthesis experiment.')
  parser.add_argument('-n', type=int, help='Number of repetitions', default=5)
  parser.add_argument('--filter', type=str, help='Filter which experiments to run', default="")
  parser.add_argument('-r', '--run', help='Only run the first experiment', action='store_true')

  argv = parser.parse_args()

  workdir = os.path.abspath(os.path.dirname(__file__) + "/../tests")
  n = argv.n


  only_run = argv.run

  out = ""
  if not only_run:
    out = workdir + "/out"
    if os.path.exists(out):
      shutil.rmtree(out)
    os.mkdir(out)
  categories = []
  for f in os.listdir(workdir):
    if os.path.isfile(workdir + "/" + f):
      categories.append(f)

  line = "-" * 80
  for e in categories:
    category = e[0:-5].replace("/", "-")
    try:
      examples = json.loads(open(workdir + "/" + e).read())
    except ValueError as ex:
      print "Failed to parse configuration: " + str(ex)
      sys.exit(1)
    for example in examples:
      title = example['name']
      if argv.filter != "" and re.search(argv.filter, title, re.UNICODE) is None:
        continue
      name = title[title.rfind(".")+1:]
      function = "\n".join(example['function'])
      argnames = example['argnames']
      arguments = example['arguments']
      if not only_run:
        print line
        print "Experiment: " + title
      args = '"' + ('" "'.join(arguments)) + '"'
      succ_time = 0.0
      succ_count = 0
      succ_iterations = 0
      for i in range(n):
        if not only_run:
          sys.stdout.write('  Running try #' + str(i+1))
          sys.stdout.flush()
        t = time.time()
        command = './model-synth synth --out "%s/%s-%s-%d.js" "%s" "%s" %s' % (out, category, name, i, argnames, function, args)
        if only_run:
          command = './model-synth synth "%s" "%s" %s' % (argnames, function, args)
          os.system(command)
          sys.exit(0)
        val, output = execute(command)
        elapsed_time = time.time() - t
        print ". Exit status %d after %.2f seconds." % (val, elapsed_time)
        if val == 0:
          succ_count += 1
          succ_time += elapsed_time
          iters = int([m.group(1) for m in re.finditer('Found in ([0-9]+) iteration', output)][-1])
          succ_iterations += iters
      print "Success rate: %.2f%%" % (float(succ_count) * 100.0/float(n))
      print "Average time until success: %.2f seconds" % (succ_time / float(n))
      print "Average iterations until success: %.1f" % (float(succ_iterations) / float(n))
  print line

# print a string to a file
def fprint(f, s):
  f = open(f, 'w')
  f.write(s)
  f.close()

# print a string to a file
def fprinta(f, s):
  f = open(f, 'a')
  f.write(s)
  f.close()

def execute(cmd):
  return Command(cmd).run(None)

# taken from http://stackoverflow.com/questions/1191374/subprocess-with-timeout
class Command(object):
  def __init__(self, cmd):
    self.cmd = cmd
    self.process = None
    self.output = ""
    self.error = ""

  def run(self, timeout):
    def target():
      self.process = subprocess.Popen(self.cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
      self.output = self.process.stdout.read()
      self.error = self.process.stderr.read()
      self.child = self.process.communicate()[0]

    thread = threading.Thread(target=target)
    thread.start()

    thread.join(timeout)
    if thread.is_alive():
      self.process.terminate()
      thread.join()
    retval = self.process.returncode
    return (retval, self.output + "\n" + self.error)

if __name__ == '__main__':
  main()
