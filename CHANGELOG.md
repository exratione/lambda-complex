# Changelog

## 0.7.0

  * Deal with the changes in NPM since the last update, particularly local
packages now installing as symlinks rather than being copied into place.

## 0.6.0

  * Rename and export Grunt tasks.
  * Update documentation, add an overview diagram.

## 0.5.1

  * Minor configuration validation improvement.

## 0.5.0

  * Improve configuration validation.
  * Expand unit test converage.

## 0.4.0

  * Add option to delete old CloudWatch log groups on deployment.
  * Make deployment options for stack deletion more granular.

## 0.3.2

  * `VisibilityTimeout` cannot be 0 in the `decrementConcurrencyCount` function, as this can cause message deletion to fail silently.

## 0.3.1

  * Alter increment/decrement error behavior in invoker to match coordinator.
  * Fix concurrency decrement for the case in which no message is found.

## 0.3.0

  * Upload `config.js` alongside the other deployment files. Helpful to keep a record.
  * The first coordinator instances following deployment upload `confirm.txt` on success.
  * Deployment waits for `confirm.txt` to exist.

## 0.2.0

  * Add a maximum concurrency limit for `eventFromMessage` components.
  * Allow multiple concurrent coordinator instances.
  * Improve documentation.

## 0.1.0

  * Initial release.
