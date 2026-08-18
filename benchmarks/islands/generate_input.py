import random
import sys

n = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 42

random.seed(seed)
with open("input.txt", "w") as f:
    f.write(f"{n}\n")
    cells = [str(random.randint(0, 1)) for _ in range(n * n)]
    f.write(" ".join(cells))

print(f"wrote input.txt: {n}x{n} grid ({n * n} cells)")
