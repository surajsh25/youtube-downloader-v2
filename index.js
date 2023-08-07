const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
const cp = require('child_process');
const ffmpeg = require('ffmpeg-static');
const app = express();

app.use(cors());
const PORT = 3000;

// Define a route
app.get('/', (req, res) => {
    res.send('Hello, Express!');
});


const convertURL = (url) => {
    let newUrlArray;
    if (url.includes("youtu.be")) {
        newUrlArray = url.split("https://youtu.be/")
        return `https://youtube.com/watch?v=${newUrlArray[1]}`
    } else if (url.includes("https://youtube.com/shorts/")) {
        newUrlArray = url.split("https://youtube.com/shorts/")
        return `https://youtube.com/watch?v=${newUrlArray[1]}`
    } else {
        return url
    }
}

// video
app.get('/video', async (req, res) => {
    const videoId = convertURL(req.query.videoId)
    let info = await ytdl.getInfo(videoId);
    res.json(info)
})

// audio
app.get("/audio", async (req, res) => {
    const videoId = convertURL(req.query.videoId)
    let info = await ytdl.getInfo(videoId)
    let audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    res.json(audioFormats)
})

app.get('/convert', (req, res) => {
    const { itag, title } = req.query
    const videoId = convertURL(req.query.videoId)
    const video = ytdl(videoId, { filter: format => format.itag === parseInt(itag) });
    const audio = ytdl(videoId, { quality: 'highestaudio' });
    const ffmpegProcess = cp.spawn(ffmpeg, [
        // Remove ffmpeg's console spamming
        '-loglevel', '8', '-hide_banner',
        // Redirect/Enable progress messages
        '-progress', 'pipe:3',
        // Set inputs
        '-i', 'pipe:4',
        '-i', 'pipe:5',
        // Map audio & video from streams
        '-map', '0:a',
        '-map', '1:v',
        // Keep encoding
        '-c:v', 'copy',
        // Define output file
        `${title}.mp4`,
    ], {
        windowsHide: true,
        stdio: [
            /* Standard: stdin, stdout, stderr */
            'inherit', 'inherit', 'inherit',
            /* Custom: pipe:4, pipe:5, pipe:6 */
            'pipe', 'pipe', 'pipe',
        ],
    });

    ffmpegProcess.on('close', () => {
        res.status(200).json({ success: true });
    });

    audio.pipe(ffmpegProcess.stdio[4]);
    video.pipe(ffmpegProcess.stdio[5]);
})

app.get('/downloadVideo', function (req, res) {
    const { title } = req.query
    var file = __dirname + `/${title}.mp4`;

    var filename = path.basename(file);
    var mimetype = mime.lookup(file);

    res.setHeader('Content-disposition', 'attachment; filename=' + filename);
    res.setHeader('Content-type', mimetype);

    var filestream = fs.createReadStream(file);
    filestream.pipe(res);
    setTimeout(() => {
        // console.log('Every 1 second');
        fs.unlinkSync(file)
    }, 5000)
});

app.get('/download', async (req, res) => {
    const { itag, title, type } = req.query
    const videoId = convertURL(req.query.videoId)
    if (type === "mp4") {
        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
        res.header('Content-Type', 'video/mp4');
    } else if (type === "mp3") {
        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.header('Content-Type', 'audio/mp3');
    }
    ytdl(videoId, { filter: format => format.itag === parseInt(itag) }).pipe(res);
})

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});