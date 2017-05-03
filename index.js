var fs     = require('fs'),
    rotate = require('petit-rotate');

var current,
    levels = ['debug', 'info', 'notice', 'warn', 'error', 'critical'];

var colors = {
  light_cyan:   '1;36', // debug
  white:        '1;37', // info
  yellow:       '1;33', // notice
  yellow_two:   '1;33', // warn
  light_red:    '1;31', // error
  light_purple: '1;35', // critical
  light_gray:   '37',
  gray:         '90',
  black:        '30',
  dark_gray:    '1;30',
  red:          '31',
  green:        '32',
  light_green:  '1;32',
  brown:        '33',
  blue:         '34',
  purple:       '35',
  cyan:         '36',
  bold:         '1'
};

function pad(str, len, char) {
  return (new Array(len).join(char || ' ') + str).slice(-len);
}

function get_levels(prefix, instance) {
  var res = {};

  levels.forEach(function(level) {
    res[level] = function(str) {
      var obj = this.write ? this : instance;

      if (obj.level <= levels.indexOf(level))
        obj.log(level, str, prefix);
    }
  })
  return res;
}

//////// the logger object

var Logger = function(opts) {
  var self = this;
  this.stream    = opts.stream ? opts.stream : opts.file ? fs.createWriteStream(opts.file, {flags: 'a'}) : process.stdout;
  this.paintable = this.stream.isTTY;
  this.set_level(opts.level || 'info');
  this.rotate_opts = {
    rotate   : opts.rotate,
    path     : opts.file,
    dest     : opts.dest,
    size     : opts.size,
    limit    : opts.limit,
    compress : opts.compress
  }

  if (opts.show_date === false) {
    this.get_date = function() { return '' }
  }

  function handle_error(err) {
    if (!process.stdout.writable)
      return self.pause();

    // fallback to stdout if writable
    self.stream = process.stdout;
    self.stream.on('error', handle_error);
    self.error(err.message + ' - ' + err.code);
  }

  this.stream.on('error', handle_error);
}

Logger.prototype.pause = function() {
  this.previous_level = this.level;
  this.level = 10;
  // this.stream.pause();
}

Logger.prototype.resume = function() {
  this.level = this.previous_level;
  // this.stream.resume();
}

Logger.prototype.set_level = function(level) {
  this.level = levels.indexOf(level);
}

Logger.prototype.color_level = function(level) {
  var color = Object.keys(colors)[levels.indexOf(level)];
  return this.paint(pad(level, 9), color);
}

Logger.prototype.get_date = function() {
  return this.paint(new Date().toUTCString(), 'gray');
}

Logger.prototype.format_prefix = function(str) {
  if (!str) return;
  return this.paint('[' + str + ']', 'blue');
}

Logger.prototype.log = function(level, str, prefix) {
  var arr = [this.color_level(level), this.get_date(), this.format_prefix(prefix), str],
      str = arr.filter(function(el) { return !!el }).join(' ');

  return this.write(str);
}

Logger.prototype.write = function(str) {
  var self = this;
  var next = function() {
    if (self.stream.writable) self.stream.write(str + '\n');
  }
  rotate(str, self.rotate_opts, function(err, rotating) {
    if (err) {
      self.rotate_opts.rotate = false;
      next();
    }
    if (!rotating) next();
  });
}

Logger.prototype.paint = function(str, color) {
  if (!str || str == '') return '';
  return this.paintable && color ? ['\033[', colors[color], 'm', str, '\033[0m'].join('') : str;
};

Logger.prototype.scope = function(str) {
  return get_levels(str, this);
}

Logger.prototype.prefix = function(str) {
  // this.write('.prefix() will be deprecated on next version. Use .scope() instead');
  return this.scope(str);
}

var fx = get_levels();
for (var key in fx) {
  Logger.prototype[key] = fx[key];
}

//////// exports

function get(opts) {
  if (current) {
    if (opts) current.write('WARNING: Ignoring options, because previous logger instance exists.');
    return current;
  }
  current = init(opts);
  return current;
}

function init(opts) {
  return new Logger(opts || {});
}

module.exports = get;
module.exports.get = get;
module.exports.new = init;

module.exports.scope = function(str) {
  var logger = get();
  return logger.scope(str);
}

module.exports.current = function(opts) {
  this.write(".current() will be deprecated on next version. Use require('petit')() directly instead.");
  return init(opts);
}
