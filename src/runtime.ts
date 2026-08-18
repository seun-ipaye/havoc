// The fixed, handwritten C runtime linked into every compiled Havoc program
// (Part 0: arena allocation, bounds-checked arrays, token-stream stdin).
// Embedded directly into the generated .c file so a Havoc build is a single
// `cc program.c -o program` with no separate linking step.

export const RUNTIME_PRELUDE = `#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>

// Programs are single-shot: allocate from a bump arena and never free.
// No GC, no manual frees, no use-after-free — the OS reclaims everything
// when the process exits.
static const size_t HAVOC_ARENA_SIZE = 256 * 1024 * 1024;
static unsigned char* havoc_arena;
static size_t havoc_arena_used = 0;

static void havoc_arena_init(void) {
    havoc_arena = (unsigned char*)malloc(HAVOC_ARENA_SIZE);
    if (!havoc_arena) {
        fprintf(stderr, "havoc: failed to allocate arena\\n");
        exit(1);
    }
}

static void* havoc_alloc(size_t size) {
    size_t aligned = (size + 7) & ~((size_t)7);
    if (havoc_arena_used + aligned > HAVOC_ARENA_SIZE) {
        fprintf(stderr, "havoc: out of memory\\n");
        exit(1);
    }
    void* ptr = havoc_arena + havoc_arena_used;
    havoc_arena_used += aligned;
    return ptr;
}

typedef struct {
    int64_t* data;
    int64_t length;
} HavocIntArray;

static int64_t havoc_index(HavocIntArray arr, int64_t i) {
    if (i < 0 || i >= arr.length) {
        fprintf(stderr, "runtime error: index %lld out of bounds for array of length %lld\\n",
                (long long)i, (long long)arr.length);
        exit(1);
    }
    return arr.data[i];
}

// Reads off one shared whitespace-delimited token stream over all of
// stdin (like cin >> or sys.stdin.read().split()), not line-based.
static int64_t havoc_read_int(void) {
    int c = getchar();
    while (c == ' ' || c == '\\t' || c == '\\n' || c == '\\r') {
        c = getchar();
    }
    int sign = 1;
    if (c == '-') {
        sign = -1;
        c = getchar();
    }
    int64_t value = 0;
    while (c >= '0' && c <= '9') {
        value = value * 10 + (c - '0');
        c = getchar();
    }
    if (c != EOF) {
        ungetc(c, stdin);
    }
    return value * sign;
}

static HavocIntArray havoc_read_ints(int64_t n) {
    int64_t* data = (int64_t*)havoc_alloc(sizeof(int64_t) * (size_t)n);
    for (int64_t i = 0; i < n; i++) {
        data[i] = havoc_read_int();
    }
    HavocIntArray arr;
    arr.data = data;
    arr.length = n;
    return arr;
}

static void havoc_print_int(int64_t x) {
    printf("%lld\\n", (long long)x);
}
`;
