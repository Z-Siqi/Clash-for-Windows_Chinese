/*jshint node:true */
module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        complexity: {
            options: {
                errorsOnly: false,
                cyclomatic: 10,
                halstead: 30,
                maintainability: 85
            },
            generic: {
                src: [
                    'mousetrap.js'
                ]
            },
            plugins: {
                src: [
                    'plugins/**/*.js',
                    '!plugins/**/tests/**',
                    '!plugins/**/*.min.js'
                ]
            }
        }
    });

    grunt.loadNpmTasks('grunt-complexity');

    grunt.registerTask('default', [
        'complexity'
    ]);
};
