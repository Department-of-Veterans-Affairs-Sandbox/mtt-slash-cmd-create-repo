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
    const issueNumber = core.getInput('issue_number', { required: true, trimWhitespace: true })
    const org = core.getInput('org', { required: true, trimWhitespace: true })
    const repo = core.getInput('repo', { required: true, trimWhitespace: true })
    const githubToken = core.getInput('token', { required: true, trimWhitespace: true })
    const repoToCreate = _body[_body.length - 1]

    let message = "";

    //log info 
    core.info(`ACTOR: ${actor}`)
    core.info(`body: ${_body}`)
    core.info(`ORG: ${org}`)
    core.info(`Current REPO: ${repo}`)
    core.info(`Issue number: ${issueNumber}`)
    core.info(`REPO to create: ${repoToCreate}`)
    //
    
    //check repo and create repo
    try {
        core.info('Creating repo client')
        const client = await newClient(adminToken)
        core.debug('Repo Client created')

        let repoExist = true;

        core.info('Getting repo')
        await client.repos.get({
            owner: org,
            repo: repoToCreate
        })
            .then((response) => {
                //let data = JSON.stringify(response)
                //core.info(data)
                core.info('Got repo')    
            })
            .catch((e) => {
                repoExist = false;
                core.error(e.message)
            })
        
        if(!repoExist){
            core.info(`Creating repo ${repoToCreate}`)

            await client.repos.createInOrg({
                org: org,
                name: repoToCreate,
                private: false
            })

            message = `Created repo ${repoToCreate}`
            core.info(message)
        }else{
            message = `Repo ${repoToCreate} already exists in org {org}`
            core.info(message)
        }

    } catch (e) {
        message = `Failed to create repo: ${e.message}`
        core.setFailed(message)
    }

    //then update issue
    try {
        core.info('Creating client')
        const client = await newClient(githubToken)
        core.debug('Client created')
       
        core.info('Creating issue')
        await client.issues.createComment({
            owner: org,
            repo: repo,
            issue_number: issueNumber,
            body: message
        })
        core.debug('Issue created')
    } catch (e) {
        core.setFailed(`Failed to comment on issue: ${e.message}`)
    }

}

main().catch(e => core.setFailed(e.message))