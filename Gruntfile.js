var remapify = require('remapify');

module.exports = function(grunt) {

  'use strict';

  // Project configuration
  grunt.initConfig({
    bower: {
      install: {
        options: {
          copy: false
        }
      }
    },
    bower_concat: {
      all: {
        dest: 'bower_components/concat.js',
        exclude: [ 'fontawesome' ]
      }
    },
    replace: {
      monkeypatch: {
        src: ['bower_components/concat.js'],
        overwrite: true,
        replacements: [{
          from: /clickDate: function \(e\) \{/g,
          to: 'clickDate: function (e) {\n\n// MONKEY PATCH BY GRUNT: Needed for the mobile version.\nthis.element.trigger(\'dateSelected.daterangepicker\', this);\n'
        }]
      }
    },
    dustjs: {
      all: {
        files: {
          'static/dist/reporting-views.js': [
            'packages/kujua-reporting/templates/kujua-reporting/*.html'
          ]
        },
        options: {
          prepend: '/* Generated by grunt dustjs */\n\n' +
                   'var dust = require("dust");\n\n',
          fullname: function(fullname) {
            return fullname.replace('packages/kujua-reporting/templates/', '');
          }
        }
      }
    },
    browserify: {
      options: {
        preBundleCB: function (b) {
          b
          .ignore('./flashmessages')
          .plugin(remapify, getBrowserifyMappings());
        }
      },
      dist: {
        files: {
          'static/dist/inbox.js': ['static/js/inbox.js']
        }
      }
    },
    concat: {
      js: {
        src: [
          'bower_components/concat.js',
          'static/js/bootstrap-multidropdown.js',
          'static/dist/inbox.js'
        ],
        dest: 'static/dist/inbox.js',
      }
    },
    uglify: {
      options: {
        banner: '/*! Medic Mobile <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        files: {
          'static/dist/inbox.js': ['static/dist/inbox.js']
        }
      }
    },
    jshint: {
      options: {
        jshintrc: true,
        ignores: [
          'static/js/*.min.js',
          'static/js/bootstrap-datetimepicker.js',
          'static/js/jquery-ext.js',
          'static/js/json2.js',
          'static/js/browser.js'
        ]
      },
      all: [
        'Gruntfile.js',
        'static/js/**/*.js',
        'tests_ui/**/*.js'
      ]
    },
    less: {
      all: {
        files: {
          'static/dist/app.css': 'static/css/app.less',
          'static/dist/inbox.css': 'static/css/inbox.less'
        }
      }
    },
    autoprefixer: {
      all: {
        src: 'static/dist/*.css'
      },
    },
    copy: {
      inbox: {
        files: [
          {
            expand: true,
            flatten: true,
            src: [
              'bower_components/select2/*.gif',
              'bower_components/select2/*.png'
            ], 
            dest: 'static/dist/'
          }
        ]
      },
      settings: {
        src: 'kanso.json',
        dest: 'static/dist/root.js',
        options: {
          process: function (content) {
            return '/* Generated by grunt copy:settings, from kanso.json */\n\n' +
                   'module.exports = ' + content + ';';
          }
        }
      },
      admin: {
        files: [
          {
            expand: true,
            flatten: true,
            src: [
              'bower_components/select2/select2.js',
              'bower_components/raphael/raphael.js'
            ], 
            dest: 'static/dist/'
          }
        ]
      }
    },
    exec: {
      deploy: {
        cmd: function() {
          var auth = '';
          if (grunt.option('user') && grunt.option('pass')) {
            auth = grunt.option('user') + ':' + grunt.option('pass') + '@';
          }
          return 'kanso push http://' + auth + 'localhost:5984/medic';
        }
      },
      phantom: {
        cmd: 'phantomjs scripts/nodeunit_runner.js http://localhost:5984/medic/_design/medic/_rewrite/test'
      }
    },
    watch: {
      css: {
        files: ['static/css/**/*'],
        tasks: ['mmcss', 'exec:deploy', 'notify:deployed']
      },
      js: {
        files: ['static/js/**/*', 'packages/kujua-reporting/**/*'],
        tasks: ['mmjs', 'exec:deploy', 'notify:deployed']
      },
      other: {
        files: ['templates/**/*', 'lib/**/*', 'packages/kujua-utils/**/*', 'packages/kujua-sms/**/*'],
        tasks: ['exec:deploy', 'notify:deployed']
      }
    },
    notify_hooks: {
      options: {
        enabled: true,
        max_jshint_notifications: 1,
        title: 'Medic Mobile'
      }
    },
    notify: {
      deployed: {
        options: {
          title: 'Medic Mobile',
          message: 'Deployed successfully'
        }
      }
    },
    karma: {
      unit: {
        configFile: './tests_ui/karma-unit.conf.js',
        singleRun: true,
        browsers: ['Chrome', 'Firefox']
      },
      unit_ci: {
        configFile: './tests_ui/karma-unit.conf.js',
        singleRun: true,
        browsers: ['PhantomJS']
      }
    },
  });

  // Load the plugins
  grunt.loadNpmTasks('grunt-autoprefixer');
  grunt.loadNpmTasks('grunt-bower-concat');
  grunt.loadNpmTasks('grunt-bower-task');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-dustjs');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-notify');
  grunt.loadNpmTasks('grunt-text-replace');

  grunt.task.run('notify_hooks');

  // Default tasks
  grunt.registerTask('mmjs', [
    'jshint',
    'dustjs',
    'copy:settings',
    'browserify',
    'concat:js'
  ]);

  grunt.registerTask('mmcss', [
    'less',
    'autoprefixer'
  ]);

  grunt.registerTask('mmbower', [
    'bower:install',
    'bower_concat',
    'replace:monkeypatch',
    'copy:inbox',
    'copy:admin'
  ]);

  grunt.registerTask('default', [
    'mmbower',
    'mmjs',
    'mmcss'
  ]);

  grunt.registerTask('ci', [
    'default',
    'uglify',
    'karma:unit_ci',
    'exec:deploy',
    'exec:phantom'
  ]);

  grunt.registerTask('dev', [
    'default',
    'exec:deploy',
    'notify:deployed'
  ]);

  grunt.registerTask('test', [
    'karma:unit',
    'exec:phantom'
  ]);


  var getBrowserifyMappings = function() {
    return [
      {
        cwd: 'packages/db',
        src: './db.js',
        expose: ''
      },
      {
        cwd: 'packages/underscore',
        src: './underscore.js',
        expose: ''
      },
      {
        cwd: 'packages/underscore',
        src: './underscore.js',
        expose: ''
      },
      {
        cwd: 'static/dist',
        src: './root.js',
        expose: 'settings'
      },
      {
        cwd: 'packages/kujua-sms/views/lib',
        src: './*.js',
        expose: 'views/lib'
      },
      {
        cwd: 'packages/kujua-sms/kujua-sms',
        src: './utils.js',
        expose: 'kujua-sms'
      },
      {
        cwd: 'packages/kujua-utils',
        src: './kujua-utils.js',
        expose: ''
      },
      {
        cwd: 'bower_components/moment',
        src: './moment.js',
        expose: ''
      },
      {
        cwd: 'packages/kujua-reporting/kujua-reporting',
        src: './shows.js',
        expose: 'kujua-reporting'
      },
      {
        cwd: 'packages/underscore-string',
        src: './underscore-string.js',
        expose: ''
      },
      {
        cwd: 'packages/async',
        src: './async.js',
        expose: ''
      },
      {
        cwd: 'packages/couchdb-audit/couchdb-audit',
        src: './*.js',
        expose: 'couchdb-audit'
      },
      {
        cwd: 'packages/session',
        src: './session.js',
        expose: ''
      },
      {
        cwd: 'packages/duality/duality',
        src: './utils.js',
        expose: 'duality'
      },
      {
        cwd: 'packages/users',
        src: './users.js',
        expose: ''
      },
      {
        cwd: 'packages/cookies',
        src: './cookies.js',
        expose: ''
      },
      {
        cwd: 'packages/sha1',
        src: './sha1.js',
        expose: ''
      },
      {
        cwd: 'packages/dust',
        src: './dust.js',
        expose: ''
      },
      {
        cwd: 'packages/locale',
        src: './locale.js',
        expose: ''
      },
    ];
  };

};