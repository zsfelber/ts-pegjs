var copy = require('copy');
const mkdirp = require('mkdirp');
const fs = require('fs'); 

async function doit(src, dest, srcBase, then) {
 
    return new Promise((resolve,reject)=>{
        function check_finish(err, file) {
            console.log("copy "+src+" "+dest);
            if (srcBase) {
                console.log("base dir : "+srcBase);
            }
            if (err) {
                reject(err);                
            } else {
                resolve(file);
            }
        }
        copy(src, dest, {srcBase, "ignore": ["**/*$tmp.ts"]}, check_finish);
    });
}

async function doall() {

  await doit('build/ts/**/*.js*', '.');

  fs.rmdirSync("build/", { recursive: true });
}

doall();
