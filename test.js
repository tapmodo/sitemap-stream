'use strict';

const exec = require('child_process').exec;
const fs = require('fs');

const expect = require('chai').expect;
const sinon = require('sinon');

describe('SitemapStream', () => {
  describe('#constructor', () => {
    context('With invalid conf', () => {
      it('should throw an error', () => {
        let err = '';

        try { require('./index')({ limit: 0 }); }
        catch(e) { err = e.message; }

        expect(err).to.be.equal('Invalid parameters: ');
      });
    });

    context('With no conf', () => {
      const sitemap = require('./index')();

      it('should have 50000 as limit', () => {
        expect(sitemap.limit).to.be.equal(50000);
      });

      it('should have isMobile as false', () => {
        expect(sitemap.isMobile).to.be.equal(false);
      });
    });

    context('With conf', () => {
      const sitemap = require('./index')({ limit: 10, isMobile: true });

      it('should have 10 as limit', () => {
        expect(sitemap.limit).to.be.equal(10);
      });

      it('should have isMobile as true', () => {
        expect(sitemap.isMobile).to.be.equal(true);
      });
    });
  });

  describe('#changeWriteStream', () => {
    context('It is the first sitemap we write', () => {
      let sitemap = require('./index')();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')();
      });

      // TODO: To avoid multiple listeners, is there something cleaner ?
      beforeEach('mute & spy #endOfFile', () => {
        sinon.stub(sitemap, 'endOfFile', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml', done.bind(null, null));
      });

      afterEach('restore #endOfFile spy', () => {
        sitemap.endOfFile.restore();
      });

      it('should not call #endOfFile', () => {
        sitemap.changeWriteStream();

        expect(sitemap.endOfFile.callCount).to.be.equal(0);
      });

      it('should have created the file', (done) => {
        sitemap.on('sitemap-created', (fileName) => {
          fs.lstat(fileName, done);
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });

      it('should not the file contain the mobile header', (done) => {
        sitemap.on('sitemap-created', (fileName) => {
          const fileContent = fs.readFileSync(fileName);

          expect(fileContent.toString()).to.be.equal('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });

      it('should emit a "sitemap-created" event when the sitemap is frozen', (done) => {
        sitemap.on('sitemap-created', (fileName) => {
          expect(fileName).to.be.equal('sitemap-1.xml')

          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });
    });

    context('It is not the first sitemap we write', () => {
      let sitemap = require('./index')();

      beforeEach('initialize the sitemap generator', () => {
        sitemap = require('./index')();
      });

      // TODO: To avoid multiple listeners, is there something cleaner ?
      beforeEach('mute & spy #endOfFile', () => {
        sinon.stub(sitemap, 'endOfFile', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml', done.bind(null, null));
      });

      afterEach('restore #endOfFile spy', () => {
        sitemap.endOfFile.restore();
      });

      it('should call #endOfFile', () => {
        sitemap.nbInjectedUrls = sitemap.limit;

        sitemap.changeWriteStream();

        expect(sitemap.endOfFile.callCount).to.be.equal(1);
      });
    });

    context('We are on mobile mod', () => {
      let sitemap = require('./index')();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')({ isMobile: true });
      });

      // TODO: To avoid multiple listeners, is there something cleaner ?
      beforeEach('mute & spy #endOfFile', () => {
        sinon.stub(sitemap, 'endOfFile', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml', done.bind(null, null));
      });

      afterEach('restore #endOfFile spy', () => {
        sitemap.endOfFile.restore();
      });

      it('should add the mobile header', (done) => {
        sitemap.on('sitemap-created', (fileName) => {
          const fileContent = fs.readFileSync(fileName);

          expect(fileContent.toString()).to.be.equal('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0">');

          done();
        });

        sitemap.changeWriteStream();

        sitemap.writer.end();
      });
    });
  });

  describe('#inject', () => {
    context('The entry format is invalid', () => {
      let sitemap = require('./index')();

      beforeEach('initialize the sitemap-generator', () => {
        let sitemap = require('./index')();
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml', done.bind(null, null));
      });

      it('should return an error', () => {
        let errOne = '';
        let errTwo = '';

        try { sitemap.inject(); }
        catch (e) { errOne = e.message; }

        try { sitemap.inject([ '/some-path' ]); }
        catch (e) { errTwo = e.message; }

        expect(errOne).to.be.equal('Cannot read property \'url\' of undefined');
        expect(errTwo).to.be.equal('ValidationError: "value" must be an object');
      });
    });

    context('With no parameters', () => {
      let sitemap = require('./index')();
      const now = new Date().toISOString();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')();
        sitemap.nbInjectedUrls = 1;
        sitemap.date = now;
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      it('should not call #changeWriteStream', () => {
        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);

        sitemap.inject('/some-path');

        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);
      });

      it('should inject the given url with required parameters only', (done) => {
        sitemap.writer.on('finish', () => {
          const fileContent = fs.readFileSync('test.xml');

          expect(fileContent.toString()).to.be.equal(`<loc>/some-path</loc>\n<lastmod>${now}</lastmod>\n`);

          done();
        });

        sitemap.inject('/some-path');

        sitemap.writer.end();
      });
    });

    context('With all parameters', () => {
      let sitemap = require('./index')();
      const now = new Date().toISOString();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')({ isMobile: true });
        sitemap.nbInjectedUrls = 1;
        sitemap.date = now;
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      it('should inject the given url with all parameters', (done) => {
        const entry = {
          url: '/some-path',
          changeFreq: 'monthly',
          priority: 0.9
        }

        sitemap.writer.on('finish', () => {
          const fileContent = fs.readFileSync('test.xml');

          expect(fileContent.toString()).to.be.equal(`<loc>/some-path</loc>\n<lastmod>${now}</lastmod>\n<changefreq>monthly</changefreq>\n<priority>0.9</priority>\n<mobile:mobile/>\n`);

          done();
        });

        sitemap.inject(entry);

        sitemap.writer.end();
      });
    });

    context('The url we inject is the last one before writing on another file', () => {
      let sitemap = require('./index')();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')();
        sitemap.nbInjectedUrls = sitemap.limit - 1;
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      it('should not call #changeWriteStream', () => {
        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);

        sitemap.inject('/some-path');

        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);
      });
    });

    context('This is the first url we inject', () => {
      let sitemap = require('./index')();

      beforeEach('initialize the sitemap generator', () => {
        sitemap = require('./index')();
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      it('should call #changeWriteStream', () => {
        sitemap.inject('/some-path');

        expect(sitemap.changeWriteStream.callCount).to.be.equal(1);
      });
    });

    context('We overcome the limit with this injection', () => {
      let sitemap = require('./index')();

      beforeEach('generate a new sitemap generator', () => {
        sitemap = require('./index')();
        sitemap.nbInjectedUrls = sitemap.limit;
      });

      beforeEach('create a writable stream', () => {
        sitemap.writer = fs.createWriteStream(`test.xml`);
      });

      beforeEach('mute & spy #changeWriteStream', () => {
        sinon.stub(sitemap, 'changeWriteStream', () => {});
      });

      afterEach('should remove generated xml files', (done) => {
        exec('rm *.xml', done.bind(null, null));
      });

      afterEach('restore #changeWriteStream spy', () => {
        sitemap.changeWriteStream.restore();
      });

      it('should not call #changeWriteStream', () => {
        expect(sitemap.changeWriteStream.callCount).to.be.equal(0);

        sitemap.inject('/some-path');

        expect(sitemap.changeWriteStream.callCount).to.be.equal(1);
      });
    });
  });

  describe('#generateIndexFile', () => {
    let sitemap = require('./index')();

    beforeEach('generate a new sitemap generator', () => {
      sitemap = require('./index')();
    });

    afterEach('should remove generated xml files', (done) => {
      exec('rm *.xml', done.bind(null, null));
    });

    it('should emit an event "sitemapindex-created" when the sitemapindex is frozen', (done) => {
      sitemap.on('sitemapindex-created', () => {
        done();
      });

      sitemap.generateIndexFile();
    });

    it('should have created a sitemapindex file', (done) => {
      sitemap.on('sitemapindex-created', () => {
        fs.lstat('sitemapindex.xml', done);
      });

      sitemap.generateIndexFile();
    });

    it('should the sitemapindex file reference all the created sitemaps', (done) => {
      sitemap.nbInjectedUrls = sitemap.limit * 4;
      sitemap.date = new Date().toISOString();

      sitemap.on('sitemapindex-created', () => {
        const fileContent = fs.readFileSync('sitemapindex.xml');

        expect(fileContent.toString()).to.be.equal(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap>\n<loc>http://www.example.com/sitemap-1.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-2.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-3.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-4.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n<sitemap>\n<loc>http://www.example.com/sitemap-5.xml</loc>\n<lastmod>${sitemap.date}</lastmod>\n</sitemap>\n`);

        done();
      });

      sitemap.generateIndexFile();
    });
  });

  describe('#endOfFile', () => {
    let sitemap = require('./index')();

    beforeEach('generate a new sitemap generator', () => {
      sitemap = require('./index')();
    });

    beforeEach('create a writable stream', () => {
      sitemap.writer = fs.createWriteStream(`test.xml`);
    });

    afterEach('should remove generated xml files', (done) => {
      exec('rm *.xml', done.bind(null, null));
    });

    it('should close the urlset element', (done) => {
      sitemap.writer.on('finish', () => {
        const fileContent = fs.readFileSync('test.xml');

        expect(fileContent.toString()).to.be.equal('</urlset>');

        done();
      });

      sitemap.endOfFile();
    });
  });

  describe('#done', () => {
    const sitemap = require('./index')();

    beforeEach('mute & spy #endOfFile', () => {
      sinon.stub(sitemap, 'endOfFile', () => {});
    });

    beforeEach('mute & spy #generateIndexFile', () => {
      sinon.stub(sitemap, 'generateIndexFile', () => {});
    });

    afterEach('restore #endOfFile spy', () => {
      sitemap.endOfFile.restore();
    });

    afterEach('restore #generateIndexFile spy', () => {
      sitemap.generateIndexFile.restore();
    });

    it('should call #endOfFile', () => {
      expect(sitemap.endOfFile.callCount).to.be.equal(0);

      sitemap.done();

      expect(sitemap.endOfFile.callCount).to.be.equal(1);
    });

    it('should call #generateIndexFile', () => {
      expect(sitemap.generateIndexFile.callCount).to.be.equal(0);

      sitemap.done();

      expect(sitemap.generateIndexFile.callCount).to.be.equal(1);
    });
  });
});