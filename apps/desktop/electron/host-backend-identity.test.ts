import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import { attachToHostBackend, checkoutHeadIdentity } from './host-backend-attach'

const RUNTIME_COMMIT = 'a'.repeat(40)

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-backend-identity-'))
  const checkout = path.join(dir, 'update-checkout')
  const runtime = path.join(dir, 'runtime')
  fs.mkdirSync(checkout)
  fs.mkdirSync(runtime)
  execFileSync('git', ['init', '-q', checkout])
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture'],
    { cwd: checkout }
  )
  fs.writeFileSync(path.join(runtime, 'install-stamp.json'), JSON.stringify({ commit: RUNTIME_COMMIT }))

  return { checkout, dir, runtime }
}

const isGitCheckout = (root: string) => fs.existsSync(path.join(root, '.git'))

const git = async (args: string[], options: { cwd: string; timeoutMs: number }) => ({
  code: 0,
  stdout: execFileSync('git', args, { cwd: options.cwd, encoding: 'utf8', timeout: options.timeoutMs })
})

for (const sameRuntime of [true, false]) {
  test(`explicit archived runtime ${sameRuntime ? 'attaches to its matching' : 'rejects a different'} backend despite another update checkout`, async () => {
    const { checkout, dir, runtime } = fixture()

    try {
      const identity = await checkoutHeadIdentity(checkout, isGitCheckout, git, runtime)
      assert.equal(identity, RUNTIME_COMMIT)

      const attached = await attachToHostBackend(
        { isolated: false, ledgerPath: '/fixture-ledger' },
        {
          expectedCodeIdentity: async () => identity,
          backendCodeIdentity: async () => (sameRuntime ? RUNTIME_COMMIT : 'f'.repeat(40)),
          log: () => {},
          readLedger: () =>
            JSON.stringify([{ pid: 4711, port: 9119, purpose: 'serve', profile: 'default', host: '127.0.0.1' }]),
          resolveServedToken: async () => 'fixture-token',
          waitForReady: async () => undefined,
          probeWebSocket: async () => ({ ok: true })
        }
      )

      assert.equal(attached?.pid ?? null, sameRuntime ? 4711 : null)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
}

test('default checkout identity still follows its own Git HEAD', async () => {
  const { checkout, dir } = fixture()

  try {
    assert.equal(
      await checkoutHeadIdentity(checkout, isGitCheckout, git),
      execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim()
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

for (const stamp of [null, '{invalid', JSON.stringify({ commit: 'not-a-commit' })]) {
  test(`unstamped or invalid archive identity retains authenticated compatibility: ${stamp}`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-archive-identity-'))

    try {
      if (stamp !== null) {fs.writeFileSync(path.join(dir, 'install-stamp.json'), stamp)}
      assert.equal(await checkoutHeadIdentity(dir, isGitCheckout, git), null)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
}
