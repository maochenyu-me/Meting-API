import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'

const dockerignore = await readFile(new URL('../.dockerignore', import.meta.url), 'utf8')
const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8')
const workflow = await readFile(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8')
const dockerTest = await readFile(new URL('../scripts/docker/test-docker.sh', import.meta.url), 'utf8')
const providersTest = await readFile(new URL('./providers.test.js', import.meta.url), 'utf8')

describe('Docker build context', () => {
  it.each(['.git', '.workbuddy', '.env*', 'cookie/', 'node_modules', 'dist'])('excludes %s from the build context', pattern => {
    expect(dockerignore.split(/\r?\n/)).toContain(pattern)
  })

  it('passes only a CI test secret to the Docker smoke test', () => {
    expect(workflow).toContain('ci-only-test-secret')
    expect(workflow).not.toContain('secrets.METING_TOKEN')
    expect(dockerTest).toContain('-e METING_TOKEN="$METING_TOKEN"')
  })

  it('smoke tests the health page and verifies unsigned resource requests are rejected', () => {
    expect(dockerTest).toContain('/test')
    expect(dockerTest).toContain('api_code" == "401"')
  })

  it('runs the Docker publish workflow on Node LTS and installs the lockfile', () => {
    expect(workflow).toContain("node-version: '22.x'")
    expect(workflow.match(/run: npm ci/g)).toHaveLength(3)
  })

  it('runs release builds only for explicit Docker requests or version tags', () => {
    expect(workflow).toContain("if: ${{ inputs.docker == true || (github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')) }}")
    expect(workflow).toContain('branches:')
    expect(workflow).toContain('- main')
  })

  it('keeps live provider checks opt-in and retains strict status assertions', () => {
    expect(providersTest).toContain('METING_LIVE_TESTS')
    expect(providersTest).toContain("test.skipIf(!runLiveTests)")
    expect(providersTest).toContain('expect(res.status).toBeLessThan(400)')
    expect(workflow).toContain('live_provider_tests:')
    expect(workflow).toMatch(/live-provider-test:[\s\S]*?if:.*inputs\.live_provider_tests == true/)
    expect(workflow).toContain("METING_LIVE_TESTS: '1'")
    const unitTestJob = workflow.split('  unit-test:')[1].split('  live-provider-test:')[0]
    expect(unitTestJob).not.toContain('METING_LIVE_TESTS')
  })

  it('uses a Node LTS base image for the application container', () => {
    expect(dockerfile).toMatch(/^FROM node:22-alpine/m)
  })

  it('installs the exact lockfile dependency tree in the image', () => {
    expect(dockerfile).toMatch(/npm ci/)
    expect(dockerfile).not.toMatch(/npm i(?:\s|$)/)
  })
})
