(function(ns, $win){

  "use strict";

  /**
   * Extend an object with a mixin
   * @param {Object} target target object to extend
   * @param {Object} mixin object to mix into target
   * @return {*} extended object
   */
  var extend = function(target, mixin) {
    var name, method;
    for(name in mixin){
      if(mixin.hasOwnProperty(name)){
        target[name] = mixin[name]
      }
    }
    return target;
  }

  /**
   * Extend an object's prototype with a mixin
   * @param {Object} target target object to extend
   * @param {Object} mixin object to mix into target
   * @return {*} extended object
   */
  var include = function(target, mixin) {
    return extend(target.prototype, mixin);
  }

  var pubsub = {
    channels: {}, //hash of subscribed channels
    /**
     * Subscribe to event on a channel
     * @param {String} evt name of channel / event to subscribe
     * @param {Function} fn the callback to execute on message publishing
     * @param {Object} ctx the context in which the callback should be executed
     */
    on: function(evt, fn, ctx){
      this.channels[evt] = this.channels[evt] || [];
      this.channels[evt].push({fn: fn, ctx: ctx});
    },
    /**
     * Unsubscribe from an event on a channel
     * @param {String} evt name of channel / event to unsubscribe
     * @param {Function} fn the callback used when subscribing to the event
     */
    off: function(evt, fn){
      if(this.channels[evt] === undefined){ return; }
      for(var i = 0, l = this.channels[evt].length; i  < l; i++){
        var sub = this.channels[evt][i].fn;
        if(sub === fn){
          this.channels[evt].splice(i,1);
          break;
        }
      }
    },
    /**
     * Publish a message on a channel. Accepts **args after event name
     * @param {String} evt name of channel / event to trigger
     */
    trigger: function(evt){
      if(this.channels.hasOwnProperty(evt)){
        var args = Array.prototype.slice.call(arguments, 1);
        this.channels[evt].forEach( function(sub) {
          sub.fn.apply(sub.ctx, args);
        });
      }
    }
  }

  var util = {
    flash_embed_code: '<embed name="$1" id="$1" src="$2?playerInstance='+ns+'.flash.instances[\'$1\']&datetime=$3" width="1" height="1" allowscriptaccess="always"></embed>',
    use_flash: (function() {
      var a = document.createElement('audio');
      return !(a.canPlayType && a.canPlayType('audio/mpeg;').replace(/no/, ''));
    })(),
    has_flash: (function() {
      if (navigator.plugins && navigator.plugins.length && navigator.plugins['Shockwave Flash']) {
        return true;
      } else if (navigator.mimeTypes && navigator.mimeTypes.length) {
        var mimeType = navigator.mimeTypes['application/x-shockwave-flash'];
        return mimeType && mimeType.enabledPlugin;
      } else {
        try {
          var ax = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
          return true;
        } catch (e) {}
      }
      return false;
    })(),
    /**
     * Embed Flash MP3 player SWF to DOM
     * @param {String} swf_location location of MP3 player SWF
     * @param {String} id swf unique ID used for resolving callbacks from ExternalInterface to Javascript
     */
    embedFlash: function(swf_location, id){
      var d = document.createElement('div');
      d.style.position = 'absolute';
      d.style.width = '1px';
      d.style.height = '1px';
      d.style.top = '-2px';
      var flashSource = this.flash_embed_code.replace(/\$1/g, id);
      flashSource = flashSource.replace(/\$2/g, swf_location);
      flashSource = flashSource.replace(/\$3/g, (+new Date + Math.random())); // Ensure swf is not pulled from cache
      d.innerHTML = flashSource;
      document.body.appendChild(d);
      return document.getElementById(id);
    }
  };

  /**
   * Flash MP3 Audio Player Class
   * @constructor
   */
  var FlashAudioPlayer = function(){
    if(util.use_flash && !util.has_flash){
      throw new Error('Flash Plugin Missing');
    } else {
      include(FlashAudioPlayer, pubsub);
    }
  }

  FlashAudioPlayer.prototype = {
    _volume: 0, /** {Float} audio volume */
    duration: 0, /** {Float} audio duration (sec) */
    position: 0, /** {Float} audio position (sec) */
    load_percent: 0, /** {Float} audio file load percent (%) */
    seekable: false, /** {Boolean} is loaded audio seekable */
    /**
     * Initialize the player
     * @param {String} swf_src path to audio player SWF file
     */
    init: function(swf_src){
      Audio5js.flash.count += 1;
      this.id = ns + Audio5js.flash.count;
      Audio5js.flash.instances[this.id] = this;
      this.embed(swf_src);
    },
    /**
     * Embed audio player SWF in page and assign reference to audio instance variable
     * @param {String} swf_src path to audio player SWF file
     */
    embed: function(swf_src){
      this.audio = util.embedFlash(swf_src, this.id);
    },
    /**
     * ExternalInterface callback indicating SWF is ready
     */
    eiReady: function(){
      this.trigger('ready');
    },
    /**
     * ExternalInterface timeupdate callback. Fires as long as playhead position is updated (audio is being played).
     * @param {Float} position audio playback position (sec)
     * @param {Float} duration audio total duration (sec)
     * @param {Boolean} seekable is audio seekable or not (download or streaming)
     */
    eiTimeUpdate: function(position, duration, seekable){
      this.position = position;
      this.duration = duration;
      this.seekable = seekable;
      this.trigger('timeupdate', position, duration);
    },
    /**
     * ExternalInterface download progress callback. Fires as long as audio file is downloaded by browser.
     * @param {Float} percent audio download percent
     */
    eiProgress: function(percent){
      this.load_percent = percent;
      this.trigger('progress', percent);
    },
    /**
     * ExternalInterface audio load error callback.
     */
    eiLoadError: function(){
      this.trigger('error');
    },
    /**
     * ExternalInterface audio play callback. Fires when audio starts playing.
     */
    eiPlay: function(){
      this.playing = true;
      this.trigger('play');
    },
    /**
     * ExternalInterface audio pause callback. Fires when audio is paused.
     */
    eiPause: function(){
      this.playing = false;
      this.trigger('pause');
    },
    /**
     * ExternalInterface audio ended callback. Fires when audio playback ended.
     */
    eiEnded: function(){
      this.playing = false;
      this.trigger('ended');
    },
    /**
     * Resets audio position and parameters. Invoked once audio is loaded.
     */
    reset: function(){
      this.seekable = false;
      this.duration = 0;
      this.position = 0;
      this.load_percent = 0;
    },
    /**
     * Load audio from url.
     * @param {String} url URL of audio to load
     */
    load: function(url){
      this.reset();
      this.audio.load(url);
    },
    /**
     * Play audio
     */
    play: function(){
      this.audio.pplay();
    },
    /**
     * Pause audio
     */
    pause: function(){
      this.audio.ppause();
    },
    /**
     * Get / Set audio volume
     * @param {Float} v audio volume to set between 0 - 1.
     * @return {Float} current audio volume
     */
    volume: function(v){
      if(v === undefined || isNaN(parseInt(v))){
        return this._volume;
      } else {
        this.audio.setVolume(v);
        this._volume = v;
      }
    },
    /**
     * Seek audio to position
     * @param {Float} position audio position in seconds to seek to.
     */
    seek: function(position){
      this.position = position;
      this.audio.seekTo(position);
    }
  }

  /**
   * HTML5 Audio Player
   * @constructor
   */
  var HTML5AudioPlayer = function(){
    include(HTML5AudioPlayer, pubsub);
  }

  HTML5AudioPlayer.prototype = {
    _volume: 0, /** {Float} audio volume */
    duration: 0, /** {Float} audio duration (sec) */
    position: 0, /** {Float} audio position (sec) */
    load_percent: 0, /** {Float} audio file load percent (%) */
    seekable: false, /** {Boolean} is loaded audio seekable */
    /**
     * Initialize the player instance
     */
    init: function(){
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.bindEvents();
      this.trigger('ready');
    },
    /**
     * Bind DOM events to Audio object
     */
    bindEvents: function(){
      this.audio.addEventListener('timeupdate', this.onTimeUpdate.bind(this));
      this.audio.addEventListener('play', this.onPlay.bind(this));
      this.audio.addEventListener('pause', this.onPause.bind(this));
      this.audio.addEventListener('ended', this.onEnded.bind(this));
      this.audio.addEventListener('canplay', this.onLoad.bind(this));
    },
    /**
     * Audio play event handler. Triggered when audio starts playing.
     */
    onPlay: function(){
      this.playing = true;
      this.trigger('play');
    },
    /**
     * Audio pause event handler. Triggered when audio is paused.
     */
    onPause: function(){
      this.playing = false;
      this.trigger('pause');
    },
    /**
     * Audio ended event handler. Triggered when audio playback has ended.
     */
    onEnded: function(){
      this.playing = false;
      this.trigger('ended');
    },
    /**
     * Audio timeupdate event handler. Triggered as long as playhead position is updated (audio is being played).
     */
    onTimeUpdate: function(){
      if (this.audio.buffered !== null && this.audio.buffered.length) {
        this.position = this.audio.currentTime;
        this.duration = this.audio.duration;
        this.trigger('timeupdate', this.position, this.duration);
      }
    },
    /**
     * Audio canplay event handler. Triggered when audio is loaded and can be played.
     * Resets player parameters and starts audio download progress timer.
     */
    onLoad: function(){
      this.seekable = this.audio.seekable && this.audio.seekable.length > 0;
      if(this.seekable){
        this.timer = setInterval(this.onProgress.bind(this), 250);
      }
      this.reset();
    },
    /**
     * Audio download progress timer callback. Check audio's download percentage.
     * Called periodically as soon as the audio loads and can be played.
     * Cancelled when audio has fully download or when a new audio file has been loaded to the player.
     */
    onProgress: function(){
      if (this.audio.buffered !== null && this.audio.buffered.length) {
        this.load_percent = parseInt(((this.audio.buffered.end(this.audio.buffered.length-1) / this.audio.duration) * 100), 10);
        this.trigger('progress', this.load_percent);
        if(this.load_percent >= 100){
          this.clearLoadProgress();
        }
      }
    },
    /**
     * Clears periodical audio download progress callback.
     */
    clearLoadProgress: function(){
      if(this.timer !== undefined){
        clearInterval(this.timer);
        delete this.timer;
      }
    },
    /**
     * Resets audio position and parameters. Invoked once audio can be played resets playback position to zero.
     */
    reset: function(){
      // When track is ready to play we seek to start of track and pause.
      // This forces download progress to get an accurate reading.
      this.seek(0);
      this.pause();
      this.seekable = false;
      this.duration = 0;
      this.position = 0;
      this.load_percent = 0;
    },
    /**
     * Load audio from url.
     * @param {String} url URL of audio to load
     */
    load: function(url){
      this.clearLoadProgress();
      this.audio.setAttribute('src', url);
      this.audio.load();
    },
    /**
     * Play audio
     */
    play: function(){
      this.audio.play();
    },
    /**
     * Pause audio
     */
    pause: function(){
      this.audio.pause();
    },
    /**
     * Get / Set audio volume
     * @param {Float} v audio volume to set between 0 - 1.
     * @return {Float} current audio volume
     */
    volume: function(v){
      if(v === undefined || isNaN(parseInt(v))){
        return this._volume;
      } else {
        this.audio.volume = v;
        this._volume = v;
      }
    },
    /**
     * Seek audio to position
     * @param {Float} position audio position in seconds to seek to.
     */
    seek: function(position){
      this.position = position;
      this.audio.currentTime = position / 1000;
      this.play();
    }
  }

  /**
   * Default settings object
   * @type {Object}
   */
  var settings = {
    swf_path: 'audiojs.swf'
  };

  /**
   * Audio5js Audio Player
   * @param {Object} s player settings object
   * @constructor
   */
  var Audio5js = function(s){
    include(Audio5js, pubsub);
    s = s || {};
    for(var k in settings){
      if(settings.hasOwnProperty(k) && !s.hasOwnProperty(k)){
        s[k] = settings[k];
      }
    }
    this.init(s);
  }

  /**
   * Global object holding flash-based player instances.
   * Used to create a bridge between Flash's ExternalInterface calls and FlashAudioPlayer instances
   * @type {Object}
   */
  Audio5js.flash = {
    instances:{}, /** FlashAudioPlayer instance hash */
    count: 0 /** FlashAudioPlayer instance count */
  };

  Audio5js.prototype = {
    playing: false, /** {Boolean} player playback state  */
    /**
     * Initialize player instance.
     * @param {Object} s player settings object
     */
    init: function(s){
      this.settings = s;
      try{
        this.audio = util.use_flash ? new FlashAudioPlayer() : new HTML5AudioPlayer();
        this.bindAudioEvents();
        this.audio.init( util.use_flash ? s.swf_path : undefined );
      } catch(e){
        console.log(e);
      }
    },
    /**
     * Bind events from audio object to internal callbacks
     */
    bindAudioEvents: function(){
      this.audio.on('ready', this.onReady, this);
      this.audio.on('play', this.onPlay, this);
      this.audio.on('pause', this.onPause, this);
      this.audio.on('ended', this.onPause, this);
      this.audio.on('timeupdate', this.onTimeUpdate, this);
      this.audio.on('progress', this.onProgress, this);
    },
    /**
     * Load audio from URL
     * @param {String} url URL of audio to load
     */
    load: function(url){
      this.audio.load(url);
    },
    /**
     * Play audio
     */
    play: function(){
      this.audio.play();
    },
    /**
     * Pause audio
     */
    pause: function(){
      this.audio.pause();
    },
    /**
     * Toggle audio play / pause
     */
    playPause: function(){
      this[this.playing ? 'pause' : 'play']();
    },
    /**
     * Callback for audio ready event. Indicates audio is ready for playback.
     * Looks for ready callback in settings object and invokes it in the context of player instance
     */
    onReady: function(){
      if(typeof(this.settings.ready) === 'function'){
        this.settings.ready.call(this);
      }
    },
    /**
     * Audio play event handler
     */
    onPlay: function(){
      this.playing = true;
    },
    /**
     * Audio pause event handler
     */
    onPause: function(){
      this.playing = false;
    },
    /**
     * Playback end event handler
     */
    onEnded: function(){
      this.playing = false;
    },
    /**
     * Playback time update event handler
     * @param {Float} position play head position (sec)
     */
    onTimeUpdate: function(position){
      console.log(position);
    },
    /**
     * Audio download progress event handler
     * @param {Float} loaded audio download percent
     */
    onProgress: function(loaded){
      console.log(loaded);
    }
  }

  $win[ns] = Audio5js;

})('Audio5js', this);