/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./collection-common')
const helper = require('../../lib/agent_helper')
const tap = require('tap')
const collections = ['testCollection', 'testCollection2']


tap.test('cursor duration tests', function(t) {
  let agent = null
  let client = null
  let db = null
  let collection = null
  t.autoend()

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    const mongodb = require('mongodb')
    common.dropTestCollections(mongodb, collections, function(err) {
      if (err) {
        return done(err)
      }

      common.connect(mongodb, null, function(err, res) {
        if (err) {
          return done(err)
        }

        client = res.client
        db = res.db
        collection = db.collection('testCollection')
        common.populate(db, collection, done)
      })
    })
  })

  t.afterEach(function(done) {
    common.close(client, db, function(err) {
      helper.unloadAgent(agent)
      agent = null
      done(err)
    })
  })

  t.test('toArray callback duration should be greater than its parent wrapper', function(t) {
    helper.runInTransaction(agent, function(transaction) {
      collection.find({}).toArray(function onToArray(err, data) {
        setImmediate(() => {
          transaction.end()

          const parent = transaction.trace.root
          const [mongo] = parent.children
          const [callback] = mongo.children

          //const segment = agent.tracer.getSegment()
          const cbTime = callback.getExclusiveDurationInMillis()
          // current segment is this callback, must get its parent and parent's parent
          const mongoTime = mongo.getExclusiveDurationInMillis()
          const parentTime = parent.getExclusiveDurationInMillis()
          console.log(`mongoName: ${mongo.name}, parentName: ${parent.name}, cbName: ${callback.name}`)
          console.log('parentduration', parent.getDurationInMillis())
          console.log('child count: ', parent.children.length)
          console.log('mongoTime', mongoTime, 'parentTime', parentTime, 'cbTime', cbTime)
          t.ok(mongoTime > parentTime, 'toArray duration should be longer than its parent')
          t.notOk(err)
          t.equal(data[0].i, 0)
          t.end()
        })
      })
    })
  })

  t.test('toArray promise duration should be greater than its parent wrapper', function(t) {
    helper.runInTransaction(agent, async function(transaction) {
      const data = await collection.find({}).toArray()
      // const segment = agent.tracer.getSegment()
      // // asserts the toArray promise execution is longer than its parent
      // // see https://github.com/newrelic/node-newrelic/issues/788
      // const parentTime = segment.getExclusiveDurationInMillis()
      // const parentDuration = segment.getDurationInMillis()
      // const mongoTime = segment.children[0].getExclusiveDurationInMillis()
      // console.log('mongoTime', mongoTime, 'parentTime', parentTime, 'parentDuration', parentDuration)
      // console.log('child count: ', segment.children.length)
      // t.ok(mongoTime > parentTime, 'toArray promise duration should be longer than its parent')

      // t.equal(data[0].i, 0)
      // t.end()

      setImmediate(() => {
        transaction.end()

        const parent = transaction.trace.root
        const [mongo] = parent.children
        // asserts the toArray promise execution is longer than its parent
        // see https://github.com/newrelic/node-newrelic/issues/788
        const parentTime = parent.getExclusiveDurationInMillis()
        const parentDuration = parent.getDurationInMillis()
        const mongoTime = mongo.getExclusiveDurationInMillis()

        console.log(`mongoName: ${mongo.name}, parentName: ${parent.name}`)
        console.log('mongoTime', mongoTime, 'parentTime', parentTime, 'parentDuration', parentDuration)
        console.log('child count: ', parent.children.length)
        t.ok(mongoTime > parentTime, 'toArray promise duration should be longer than its parent')

        t.equal(data[0].i, 0)
        t.end()
      })
    })
  })
})
