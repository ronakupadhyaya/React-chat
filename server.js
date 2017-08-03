const express           = require('express');
const path              = require('path');
const compress          = require('compression');

const webpack               = require('webpack');
const webpackDevMiddleware  = require("webpack-dev-middleware");
const webpackHotMiddleware  = require('webpack-hot-middleware');
const config                = require('./webpack.config');

const app               = express();
const server            = require('http').Server(app);
const io                = require('socket.io')(server);

const compiler = webpack(config);
app.use(webpackDevMiddleware(compiler, {
  noInfo: true,
  publicPath: config.output.publicPath,
  stats: {
    colors: true
  },
  hot: true,
  historyApiFallback: true
}));
app.use(webpackHotMiddleware(compiler));

// Default routes
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use(compress());

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Socket handler
io.on('connection', socket => {
  console.log('connected');
  socket.on('username', username => {
    if (!username || !username.trim()) {
      return socket.emit('errorMessage', 'No username!');
    }
    socket.username = String(username);
  });

  socket.on('room', requestedRoom => {
    if (!socket.username) {
      return socket.emit('errorMessage', 'Username not set!');
    }
    if (!requestedRoom) {
      return socket.emit('errorMessage', 'No room!');
    }
    if (socket.room) {
      socket.leave(socket.room);
      socket.to(socket.room).emit('message', {
        username: 'System',
        content: `${socket.username} has left`
      });
    }
    socket.room = requestedRoom;
    socket.join(requestedRoom, () => {
      if(requestedRoom === 'Welcome Room') {
        socket.emit('message', {
          username: 'System',
          content: `Welcome ${socket.username}! You are in the Welcome Room. You can switch to a new room using the tabs above,
          to chat with people feeling the same vibes as you. Now that you got the rundown, get a (chat)room!`
        });
      }
      socket.to(requestedRoom).emit('message', {
        username: 'System',
        content: `${socket.username} has joined`
      });
    });
  });


  socket.on('message', message => {
    if (!socket.room) {
      return socket.emit('errorMessage', 'No rooms joined!');
    }
    socket.to(socket.room).emit('message', {
      username: socket.username,
      content: message
    });
  })

  socket.on('typing', message => {
    socket.to(socket.room).emit('typing', socket.username);
  });

  socket.on('stop typing', message => {
    socket.to(socket.room).emit('stop typing', socket.username);
  });
});



const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}!`);
});
