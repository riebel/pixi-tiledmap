import { type BenchFn, test } from 'vitest'

export type RegisterBench = (name: string, fn: BenchFn) => void

// A group runs all of its benchmarks inside one test, which can take minutes
// when a benchmark covers the full-rebuild fallback.
const GROUP_TIMEOUT_MS = 10 * 60_000

/**
 * One benchmark group: `define` registers its benchmarks, which then run as a
 * single comparison inside one Vitest test, as Vitest 5 benchmarks require.
 */
export function benchGroup(name: string, define: (bench: RegisterBench) => void): void {
  test(name, { timeout: GROUP_TIMEOUT_MS }, async ({ bench }) => {
    const registrations: ReturnType<typeof bench>[] = []
    define((benchName, fn) => {
      registrations.push(bench(benchName, fn))
    })
    // compare() needs at least two benchmarks; a lone one runs on its own.
    if (registrations.length === 1) await registrations[0]!.run()
    else await bench.compare(...registrations)
  })
}
