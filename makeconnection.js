conn=require('net').createConnection(1337);
conn.on('data',function(data){console.log('data',data+'')})
conn.on('end',function(){console.log('ended')});
conn.write('test')
