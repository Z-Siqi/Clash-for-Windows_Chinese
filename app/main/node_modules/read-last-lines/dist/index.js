"use strict";var fs=require("mz/fs");module.exports={/**
	 * Read in the last `n` lines of a file
	 * @param  {string}   input_file_path - file (direct or relative path to file.)
	 * @param  {int}      maxLineCount    - max number of lines to read in.
	 * @param  {encoding} encoding        - specifies the character encoding to be used, or 'buffer'. defaults to 'utf8'.
	 *
	 * @return {promise}  a promise resolved with the lines or rejected with an error.
	 */read:function f(a,b,c){var d=["\n"];null==c&&(c="utf8");var e=function(a,b,c){return fs.read(b,Buffer.alloc(1),0,1,a.size-1-c).then(function(a){return String.fromCharCode(a[1][0])})};return new Promise(function(f,g){var h={stat:null,file:null};fs.exists(a).then(function(a){if(!a)throw new Error("file does not exist")}).then(function(){var b=[fs.stat(a).then(function(a){return h.stat=a}),fs.open(a,"r").then(function(a){return h.file=a})];// Load file Stats.
return Promise.all(b)}).then(function(){var a=0,g=0,i="",j=function(){return i.length>h.stat.size&&(i=i.substring(i.length-h.stat.size)),i.length>=h.stat.size||g>=b?(d.includes(i.substring(0,1))&&(i=i.substring(1)),fs.close(h.file),"buffer"===c?f(Buffer.from(i,"binary")):f(Buffer.from(i,"binary").toString(c))):e(h.stat,h.file,a).then(function(b){i=b+i,d.includes(b)&&1<i.length&&g++,a++}).then(j)};return j()}).catch(function(a){return null!==h.file&&fs.close(h.file).catch(function(){// We might get here if the encoding is invalid.
// Since we are already rejecting, let's ignore this error.
}),g(a)})})}};