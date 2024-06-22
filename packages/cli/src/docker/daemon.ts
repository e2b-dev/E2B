import Docker from "dockerode";
import * as e2b from 'e2b'
import path from "path";
import { MultiBar, Presets } from 'cli-progress';
import fs from "fs";

var docker = new Docker();

export function testSDK() {
    docker.listContainers(function (err, containers) {
        containers?.forEach(function (containerInfo) {
            console.log(containerInfo);
            var container = docker.getContainer(containerInfo.Id)
            container.stop();
        });
    });
}

export async function dockerBuild(dockerfileRelativePath: string, templateID:string, buildID: string, dockerBuildArgs: any, root: string) {
    console.log("Building docker image using SDK")

    let stream = await docker.buildImage(
        {context: root, src: fs.readdirSync(root)}, {
            t: `docker.${e2b.SANDBOX_DOMAIN}/e2b/custom-envs/${templateID}:${buildID}`,
            platform: 'linux/amd64',
            buildargs: dockerBuildArgs,
            dockerfile: dockerfileRelativePath,
            
    });

    const multiBar = new MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: '{bar} {percentage}% | {value}/{total} MB | {id} | {status}',
    }, Presets.shades_grey);

    const bars: { [key: string]: any } = {};

    await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err: any, res: any) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
            multiBar.stop();
        }, (event: any) => {
            if (event.id && event.progressDetail) {
                if (!bars[event.id]) {
                    bars[event.id] = multiBar.create(event.progressDetail.total / (1024 * 1024), 0);
                }
                bars[event.id].update(event.progressDetail.current / (1024 * 1024), {
                    id: event.id,
                    status: event.status,
                });
            }
        });
    });

    console.log('Built docker image using SDK')
}