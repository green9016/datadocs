FROM httpd:2.4
COPY ./build/ /usr/local/apache2/htdocs/
RUN sed -i -e 's/AllowOverride None/AllowOverride All/g' /usr/local/apache2/conf/httpd.conf
RUN sed -i -e 's/\#LoadModule brotli_module modules\/mod_brotli.so/LoadModule brotli_module modules\/mod_brotli.so/g' /usr/local/apache2/conf/httpd.conf
RUN sed -i -e 's/\#LoadModule deflate_module modules\/mod_deflate.so/LoadModule deflate_module modules\/mod_deflate.so/g' /usr/local/apache2/conf/httpd.conf
