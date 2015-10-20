# Changelog

## 0.3.2

  * `VisibilityTimeout` cannot be 0 in the `decrementConcurrencyCount` function, as this can causes message deletion to fail silently.

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
