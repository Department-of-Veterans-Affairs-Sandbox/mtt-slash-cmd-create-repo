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
        core.info(`ACTOR: ${actor}`)
        core.info(`body: ${_body}`)
        core.info(`ORG: ${org}`)
        core.info(`REPO: ${repo}`)
        core.info(`REPO to create: ${repoToCreate}`)
        //

        //mtt
        // core.info('Geting repo')
        // const { data } = await client.repos.listForOrg({
        //         org: org
        //         //name: repoToCreate,
        //         //private: false
        //         //owner: org
        //         //repo: repoToCreate
        //     })
        //         .then((data) => {
        //             let obj = JSON.stringify(data)
        //             core.info(obj)
        //         })

               
        await client.repos.get({
            owner: org,
            repo: repoToCreate
        })
            .then((response) => {
                let data = JSON.stringify(response)
                core.info(data)
            })
    
        //core.info('Creating repo')

        // await client.repos.createInOrg({
        //     org: org,
        //     name: repoToCreate,
        //     private: false
        // })

        //core.debug('Repo created')

    } catch (e) {
        failed = true
        core.setFailed(`Failed to create repo: ${e.message}`)
    }

}

main().catch(e => core.setFailed(e.message))