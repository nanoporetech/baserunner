// renderer.js

const zerorpc  = require("zerorpc")
const chokidar = require("chokidar")
const path     = require("path")
const queue    = require("queue");
const electron = require('electron')
const remote   = electron.remote
const bunyan   = require('bunyan').createLogger({
    name: "baserunner",
    streams: [{
        path: 'baserunner.log',
    }]
});

/* zerorpc setup */
let client = new zerorpc.Client()
client.connect("tcp://127.0.0.1:4242")

/* logging setup */
let logTranscript = document.querySelector("#log")
logTranscript.innerHTML = (new Array(10)).join("\n");

const log = (str) => {
    let tmp                 = logTranscript.innerHTML;
    logTranscript.innerHTML = logTranscript.innerHTML.split(/\n/).splice(1, 10).join("\n") + str + "\n"
    bunyan.info(str)
}

/* progress indicator setup */
let stateIndicator       = document.querySelector("#state")
stateIndicator.innerHTML = "stopped"

/* setup button action */
let setup = document.querySelector("#setup")
let folderSelection = null
setup.addEventListener('click', () => {
    let selection=remote.dialog.showOpenDialog(null, {
	properties: ['openDirectory']
    })

    if(!selection) {
	return
    }

    folderSelection=selection
    let folder_indicator = document.querySelector("#folders")
    folder_indicator.innerHTML = folderSelection.join(",");
})

let workWaiting = new Array()
let workSuccess = 0
let workFailure = 0
let progress    = document.querySelector("#progress")
let watcher     = null;
let workQueue   = queue({
    concurrency: 1,
    autostart: 1
})

const workIndicatorUpdate = () => {
    let perc  = 100 * (workSuccess + workFailure) / (workQueue.length + workSuccess + workFailure)
    let percS = 100 * (workSuccess) / (workQueue.length + workSuccess + workFailure)
    let percF = 100 * (workFailure) / (workQueue.length + workSuccess + workFailure)
//    let bar  = document.querySelector("#workProgress .progress");
//    let pxw  = bar.parentElement.offsetWidth * perc / 100
//    bar.style.setProperty('width', pxw + "px");

    let barS  = document.querySelector("#workProgress .success");
    let pxwS  = barS.parentElement.offsetWidth * percS / 100
    barS.style.setProperty('width', pxwS + "px");

    let barF  = document.querySelector("#workProgress .failure");
    let pxwF  = barF.parentElement.offsetWidth * percF / 100
    barF.style.setProperty('width', pxwF + "px");

    document.querySelector("#workProgress .label").innerHTML = perc.toFixed(2) + "% (" + workSuccess + " : " + workFailure + " : " + workWaiting.length + ")";
}

let workIndicatorInterval = null

const checkWork = (qcb) => {

    let cb = () => {
	workIndicatorUpdate()
	workQueue.push(checkWork) // self-perpetuating
	qcb()
    }

    let len = workWaiting.length
    if(len) {
	let path = workWaiting.shift()
	log("begin job " + path);
	client.invoke("process_read", path, (error, res) => {
	    if(error) {
		log("error job " + path);
		console.error(error)
		workFailure++
	    } else {
		log("end job " + path);
		console.log(res.toString());
		workSuccess++
	    }
	    /* immediately check for more work */
	    return cb()
	})

    } else {
	/* no work to do. wait for a bit */
	log("nothing to do")
	setTimeout( () => { cb(); }, 5000);
    }
}

/* start button action */
let start = document.querySelector("#start")
start.addEventListener('click', () => {
    if(!folderSelection) {
	alert("please set up a folder")
	return
    }
    log("selected " + folderSelection)

    workDone   = 0
    workFailed = 0
    workIndicatorInterval = setInterval(workIndicatorUpdate, 5000)

    setup.setAttribute("disabled","disabled")
    start.setAttribute("disabled","disabled")
    stop.removeAttribute("disabled")

    let tmp = folderSelection.map(function(o) {
	return path.join(o, "**", "*.fast5");
    });

    watcher = chokidar.watch(tmp, {
	depth: 2,
	ignored: /(^|[\/\\])\../
    })
	.on('add', (path, stats) => {
	    log(`queued ${path}`);
	    workWaiting.push(path)
	});
    stateIndicator.innerHTML = "running"

    /* kick off */
    workQueue.push(checkWork)
})

/* stop button action */
let stop = document.querySelector("#stop")
stop.addEventListener('click', () => {
    if(!watcher) {
	alert("already stopped")
	return
    }

    watcher.close()
    stateIndicator.innerHTML="stopped"
    workQueue.end("stopping")
    workWaiting=[]
    workIndicatorUpdate()
    clearInterval(workIndicatorInterval)

    setup.removeAttribute("disabled")
    start.removeAttribute("disabled")
    stop.setAttribute("disabled", "disabled")
})

setup.removeAttribute("disabled")
start.removeAttribute("disabled")
stop.setAttribute("disabled","disabled")
