// --- lop-hoc-backend/server.js ---
// (PHIÊN BẢN MỚI 3.6) - ĐẦY ĐỦ 100% - KHÔNG CÓ "GIỮ NGUYÊN"

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // Cho phép cross-origin

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Tạm thời cho phép mọi origin
    methods: ['GET', 'POST'],
  },
  // Tăng giới hạn gói tin để gửi PDF/Audio
  maxHttpBufferSize: 1e8 // 100 MB
});

// Bộ nhớ server (Trạng thái lớp học)
let classroomState = {
  currentView: 'whiteboard', // 'whiteboard' hoặc 'slides'
  
  currentPDF: null, // Dữ liệu PDF (base64)
  currentPage: 1, // Trang PDF hiện tại
  pdfAnnotations: {}, // Các nét vẽ, { 1: [...], 2: [...] }

  currentQuiz: null, // { question, options, studentAnswer, correctAnswer }
  currentYouTubeId: null, // ID video YouTube
  
  isHandRaised: false, // Trạng thái giơ tay
};


io.on('connection', (socket) => {
  console.log(`Một người dùng đã kết nối: ${socket.id}`);

  // Gửi cho người mới vào toàn bộ trạng thái lớp học
  socket.emit('classroom state', classroomState);

  // --- Xử lý Chat ---
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg); // Gửi cho mọi người (cả người gửi)
  });

  // --- Xử lý Bảng trắng ---
  socket.on('draw start', (data) => {
    socket.broadcast.emit('draw start', data); // Gửi cho người kia
  });
  
  socket.on('draw move', (data) => {
    socket.broadcast.emit('draw move', data); // Gửi cho người kia
  });
  
  socket.on('draw end', () => {
    socket.broadcast.emit('draw end'); // Gửi cho người kia
  });

  socket.on('clear board', () => {
    io.emit('clear board'); // Gửi cho mọi người
  });

  // --- Xử lý Audio Stream ---
  socket.on('start stream', () => {
    socket.broadcast.emit('start stream'); // Báo cho học sinh
  });
  
  socket.on('stop stream', () => {
    socket.broadcast.emit('stop stream'); // Báo cho học sinh
  });
  
  socket.on('audio chunk', (chunk) => {
    socket.broadcast.emit('audio chunk', chunk); // Gửi mẩu audio
  });

  // --- Xử lý Tab và PDF ---
  socket.on('change view', (viewName) => {
    classroomState.currentView = viewName;
    io.emit('view changed', viewName); // Gửi cho mọi người
  });
  
  socket.on('upload pdf', (pdfData) => {
    classroomState.currentPDF = pdfData; // Lưu file PDF base64
    classroomState.currentPage = 1; // Reset về trang 1
    classroomState.pdfAnnotations = {}; // Xóa mọi nét vẽ cũ
    
    io.emit('pdf updated', pdfData); // Gửi PDF mới cho mọi người
    io.emit('annotations updated', classroomState.pdfAnnotations); // Gửi bộ nét vẽ rỗng
  });
  
  socket.on('change page', (newPage) => {
    classroomState.currentPage = newPage;
    io.emit('page changed', newPage); // Gửi cho mọi người
  });

  socket.on('pdf draw event', (drawData) => {
    const { pageNum, eventType, data } = drawData;
    if (!classroomState.pdfAnnotations[pageNum]) {
      classroomState.pdfAnnotations[pageNum] = [];
    }
    classroomState.pdfAnnotations[pageNum].push({ eventType, data });
    
    // Gửi cho người kia
    socket.broadcast.emit('pdf draw event', drawData);
  });
  
  socket.on('clear pdf annotations', (pageNum) => {
    if (classroomState.pdfAnnotations[pageNum]) {
      classroomState.pdfAnnotations[pageNum] = [];
    }
    // Gửi cho mọi người (bao gồm cả người vừa xóa)
    io.emit('annotations cleared', pageNum);
  });


  // --- XỬ LÝ QUIZ ---
  socket.on('teacher update quiz', (quizData) => {
    classroomState.currentQuiz = quizData;
    io.emit('quiz updated', classroomState.currentQuiz); // Gửi cho mọi người
  });

  socket.on('student submit answer', (answerIndex) => {
    if (classroomState.currentQuiz) {
      classroomState.currentQuiz.studentAnswer = answerIndex;
      io.emit('quiz updated', classroomState.currentQuiz); // Gửi cho mọi người
    }
  });

  socket.on('teacher close quiz', () => {
    classroomState.currentQuiz = null;
    io.emit('quiz updated', null); // Gửi cho mọi người
  });
  
  
  // --- XỬ LÝ YOUTUBE ---
  socket.on('teacher play youtube', (videoId) => {
    classroomState.currentYouTubeId = videoId;
    io.emit('youtube updated', videoId); // Gửi cho mọi người
  });

  // --- XỬ LÝ GIƠ TAY ---
  socket.on('student raise hand', () => {
    classroomState.isHandRaised = true;
    io.emit('hand raised status', true); // Gửi cho mọi người (cả 2)
  });
  
  socket.on('teacher lower hand', () => {
    classroomState.isHandRaised = false;
    io.emit('hand raised status', false); // Gửi cho mọi người (cả 2)
  });


  // --- Xử lý Ngắt kết nối ---
  socket.on('disconnect', () => {
    console.log(`Một người dùng đã ngắt kết nối: ${socket.id}`);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server đang chạy "ngon lành" trên cổng ${PORT}`);
});