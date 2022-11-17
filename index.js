const core = require('@actions/core')
const { Octokit } = require("@octokit/rest")
const { retry } = require("@octokit/plugin-retry")
const { throttling } = require("@octokit/plugin-throttling")

const _Octokit = Octokit.plugin(retry, throttling)

async function newClient(token) {
    return new _Octokit({
        auth: token,
        baseUrl: process.env.GITHUB_API_URL,
        retries: 10,
        throttle: {
            onRateLimit: (retryAfter, options, octokit) => {
                octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
                if (options.request.retryCount === 0) {
                    octokit.log.info(`Retrying after ${retryAfter} seconds!`);
                    return true;
                }
            },
            onSecondaryRateLimit: (retryAfter, options, octokit) => {
                octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`);
                if (options.request.retryCount === 0) {
                    octokit.log.info(`Retrying after ${retryAfter} seconds!`);
                    return true;
                }
            },
        }
    });
}

async function main() {
    const actor = core.getInput('actor', { required: true, trimWhitespace: true })
    const adminToken = core.getInput('admin_token', { required: true, trimWhitespace: true })
    const _body = core.getInput('body', { required: true, trimWhitespace: true }).trim().split(' ')
        //const issueNumber = core.getInput('issue_number', { required: true, trimWhitespace: true })
    const org = core.getInput('org', { required: true, trimWhitespace: true })
    const repo = core.getInput('repo', { required: true, trimWhitespace: true })
    const githubToken = core.getInput('token', { required: true, trimWhitespace: true })
    const repoToCreate = _body[_body.length - 1]

    let failed = false
    try {
        core.info('Creating client')
        const client = await newClient(adminToken)
        core.debug('Client created')

        //log info 
        // core.info(`ACTOR: ${actor}`)
        // core.info(`body: ${_body}`)
        // core.info(`ORG: ${org}`)
        // core.info(`REPO: ${repo}`)
        // core.info(`REPO to create: ${repoToCreate}`)
        //

        //mtt
        core.info('Geting repo')
        await client.repos.get({
                //org: org,
                //name: repoToCreate,
                //private: false
                owner: org,
                repo: repoToCreate
            })
            .then((data) => {
                core.info(data)
            })
        core.info('Got repo')
            //

        core.info('Creating repo')

        await client.repos.createInOrg({
            org: org,
            name: repoToCreate,
            private: false
        })

        core.debug('Repo created')

    } catch (e) {
        failed = true
        core.setFailed(`Failed to create repo: ${e.message}`)
    }

    // try {
    //     core.info('Creating client')
    //     const client = await newClient(githubToken)
    //     core.debug('Client created')

    //     let message
    //     if (failed) {
    //         message = `@${actor} failed to archive repo ${repoToArchive}`
    //     } else {
    //         message = `@${actor} archived repo ${repoToArchive}`
    //     }
    //     core.info('Creating issue')
    //     await client.issues.createComment({
    //         owner: org,
    //         repo: repo,
    //         issue_number: issueNumber,
    //         body: message
    //     })
    //     core.debug('Issue created')
    // } catch (e) {
    //     core.setFailed(`Failed to comment on issue: ${e.message}`)
    // }
}

main().catch(e => core.setFailed(e.message))