# Number of islands: count 4-directionally connected regions of 1s in an
# n x n grid, via BFS. Naive/idiomatic Python — plain lists and a deque
# (deque is standard-library, not a shortcut around the per-node work;
# it just gives O(1) popleft, same algorithmic shape as the Havoc version).
#
# Deliberately not using numpy/scipy graph libraries: those would offload
# the actual traversal into C, which is exactly the comparison we're not
# trying to make (see Part 0/4 notes on avoiding a strawman benchmark).

import sys
from collections import deque


def count_islands(grid, n):
    visited = [0] * (n * n)
    count = 0
    for i in range(n * n):
        if grid[i] == 1 and visited[i] == 0:
            count += 1
            queue = deque([i])
            visited[i] = 1
            while queue:
                cur = queue.popleft()
                row = cur // n
                col = cur % n

                if row > 0:
                    up = cur - n
                    if grid[up] == 1 and visited[up] == 0:
                        visited[up] = 1
                        queue.append(up)
                if row < n - 1:
                    down = cur + n
                    if grid[down] == 1 and visited[down] == 0:
                        visited[down] = 1
                        queue.append(down)
                if col > 0:
                    left = cur - 1
                    if grid[left] == 1 and visited[left] == 0:
                        visited[left] = 1
                        queue.append(left)
                if col < n - 1:
                    right = cur + 1
                    if grid[right] == 1 and visited[right] == 0:
                        visited[right] = 1
                        queue.append(right)
    return count


def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    grid = list(map(int, data[1 : 1 + n * n]))
    print(count_islands(grid, n))


main()
