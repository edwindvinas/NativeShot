importScripts('chrome://nativeshot/content/resources/scripts/comm/Comm.js');
var {callInBootstrap, callInMainworker} = CommHelper.childworker;
var gWkComm = new Comm.client.worker();

var gTess;
// var gTessBig = false;
var gTessIdx = 0;
var WORKER = this;

var onTesseractProgress = undefined;
var gLastLang;
function readByteArr(aArg, aReportProgress) {
	var { method, arrbuf, width, height, lang='eng', show_progress } = aArg
	// `show_progress` only works for tesseract
	// method - string;enum['tesseract','ocrad','gocr']
	// lang only used by tessearact

	// console.info('GOCR arrbuf:', arrbuf, 'width:', width, 'height:', height, '');

	var image_data = new ImageData(new Uint8ClampedArray(arrbuf), width, height);

	switch (method) { // each block must return, no break's
		case 'gocr':

			if (typeof(GOCR) == 'undefined') {
				importScripts('chrome://nativeshot/content/resources/scripts/3rd/gocr.js');
			}
			var txt = GOCR(image_data);

			return txt;

		case 'ocrad':

			if (typeof(OCRAD) == 'undefined') {
				importScripts('chrome://nativeshot/content/resources/scripts/3rd/ocrad.js');
			}
			var txt = OCRAD(image_data);

			return txt;

		case 'tesseract':

			if (typeof(gTess) == 'undefined') {
				importScripts('chrome://nativeshot/content/resources/scripts/3rd/tesseract.js');
			}

			if (gLastLang != lang || !gTess) {
				// otherwise as user changes languages, it will load and cache more, building up, until it will keep hitting that memory error, so on every lang change, just reinit
				var memsize;
				switch (lang) {
					case 'grc':
							memsize = 12;
						break;
					case 'chi_sim':
					case 'chi_tra':
					case 'jpn':
							memsize = 10;
						break;
					default:
						memsize = 6;
				}
				gTess = tesseractinit(16777216*memsize);
				gLastLang = lang;
			}

			var options = {};
			if (show_progress && method == 'tesseract') {
				onTesseractProgress = percent => {
					aReportProgress({
						reason:'PROGRESS',
						data: {
							percent
						}
					});
				};
			} else {
				onTesseractProgress = null;
			}

			var deferred_recognize = new Deferred();

			gTess.recognize(gTessIdx++, image_data, lang, options, function(err, rez){
				console.log('err:', err, 'rez:', rez);
				if (rez) {
					deferred_recognize.resolve(rez.text);
				} else {
					deferred_recognize.resolve(null);
				}
			});

			return deferred_recognize.promise;
	}
}

// start - common helper functions
function Deferred() {
	this.resolve = null;
	this.reject = null;
	this.promise = new Promise(function(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
	}.bind(this));
	Object.freeze(this);
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};
	console.error('Rejected - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};
	console.error('Caught - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
// end - common helper functions
