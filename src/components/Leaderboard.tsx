import React, { useState, useEffect, useCallback } from 'react';

const Leaderboard = () => {
  const [userType, setUserType] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });
  const [groundTruth, setGroundTruth] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('rmse');
  const [error, setError] = useState('');

  // 평가 지표 정의
  const METRICS = {
    accuracy: {
      name: "Accuracy",
      calculate: (predictions, targets) => {
        const correct = predictions.filter((pred, i) =>
          Math.abs(pred - targets[i]) < 0.01
        ).length;
        return correct / predictions.length;
      },
      higherIsBetter: true,
      format: (value) => `${(value * 100).toFixed(2)}%`
    },
    mae: {
      name: "MAE",
      calculate: (predictions, targets) => {
        const errors = predictions.map((pred, i) =>
          Math.abs(pred - targets[i])
        );
        return errors.reduce((sum, err) => sum + err, 0) / predictions.length;
      },
      higherIsBetter: false,
      format: (value) => value.toFixed(4)
    },
    rmse: {
      name: "RMSE",
      calculate: (predictions, targets) => {
        const squaredErrors = predictions.map((pred, i) =>
          Math.pow(pred - targets[i], 2)
        );
        const mse = squaredErrors.reduce((sum, err) => sum + err, 0) / predictions.length;
        return Math.sqrt(mse);
      },
      higherIsBetter: false,
      format: (value) => value.toFixed(4)
    },
    mspe: {
      name: "MSPE",
      calculate: (predictions, targets) => {
        const percentageErrors = predictions.map((pred, i) =>
          Math.pow((targets[i] - pred) / targets[i], 2)
        );
        return percentageErrors.reduce((sum, err) => sum + err, 0) / predictions.length;
      },
      higherIsBetter: false,
      format: (value) => `${(value * 100).toFixed(2)}%`
    }
  };

  // 페이지 로드시 데이터 복원
  useEffect(() => {
    const savedUserType = localStorage.getItem('userType');
    if (savedUserType) {
      setUserType(savedUserType);
    }

    const savedIsAdmin = localStorage.getItem('isAdmin') === 'true';
    if (savedIsAdmin) {
      setIsAdmin(true);
    }

    const savedGroundTruth = localStorage.getItem('groundTruth');
    if (savedGroundTruth) {
      setGroundTruth(JSON.parse(savedGroundTruth));
    }

    const savedSubmissions = localStorage.getItem('submissions');
    if (savedSubmissions) {
      setSubmissions(JSON.parse(savedSubmissions));
    }

    const savedSelectedMetric = localStorage.getItem('selectedMetric');
    if (savedSelectedMetric) {
      setSelectedMetric(savedSelectedMetric);
    }
  }, []);

  // 상태 변경 시 로컬 스토리지 업데이트
  useEffect(() => {
    if (userType) {
      localStorage.setItem('userType', userType);
    } else {
      localStorage.removeItem('userType');
    }
  }, [userType]);

  useEffect(() => {
    localStorage.setItem('isAdmin', isAdmin.toString());
  }, [isAdmin]);

  // 입력 변경 핸들러 (최적화)
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  // 관리자 로그인 처리
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'admin' && loginData.password === 'admin123') {
      setIsAdmin(true);
      setError('');
    } else {
      setError('로그인 정보가 일치하지 않습니다');
    }
  };

  // 관리자 로그아웃
  const handleAdminLogout = () => {
    setIsAdmin(false);
    setUserType(null);
    setLoginData({ username: '', password: '' });

    // 로컬 스토리지에서 관리자 관련 데이터 제거
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userType');
  };

  // 정답 파일 처리
  const processGroundTruth = (csvText) => {
    try {
      const lines = csvText.trim().split('\n');
      const values = lines.slice(1).map(line => parseFloat(line.split(',')[1]));

      if (values.some(isNaN)) {
        throw new Error('정답 파일에 숫자가 아닌 값이 포함되어 있습니다');
      }

      setGroundTruth(values);
      setSubmissions([]);
      setError('');

      localStorage.setItem('groundTruth', JSON.stringify(values));
      return true;
    } catch (err) {
      setError('정답 파일 처리 오류: ' + err.message);
      return false;
    }
  };

  // 제출 파일 처리
  const processSubmission = (csvText, filename) => {
    try {
      if (!groundTruth) {
        throw new Error('정답 파일이 설정되지 않았습니다. 관리자에게 문의하세요.');
      }

      const lines = csvText.trim().split('\n');
      const predictions = lines.slice(1).map(line => parseFloat(line.split(',')[1]));

      if (predictions.some(isNaN)) {
        throw new Error('제출 파일에 숫자가 아닌 값이 포함되어 있습니다');
      }

      if (predictions.length !== groundTruth.length) {
        throw new Error(`예측값 개수(${predictions.length})가 정답 개수(${groundTruth.length})와 다릅니다`);
      }

      const scores = Object.keys(METRICS).reduce((acc, metric) => {
        acc[metric] = METRICS[metric].calculate(predictions, groundTruth);
        return acc;
      }, {});

      const teamName = filename.split('.')[0];
      const newSubmissions = submissions.filter(sub => sub.teamName !== teamName);
      newSubmissions.push({
        teamName,
        ...scores,
        submitTime: new Date().toLocaleString(),
        predictionsCount: predictions.length
      });

      const sortedSubmissions = newSubmissions
        .sort((a, b) => {
          return METRICS[selectedMetric].higherIsBetter
            ? b[selectedMetric] - a[selectedMetric]
            : a[selectedMetric] - b[selectedMetric];
        })
        .map((sub, index) => ({ ...sub, rank: index + 1 }));

      setSubmissions(sortedSubmissions);
      localStorage.setItem('submissions', JSON.stringify(sortedSubmissions));
      setError('');
    } catch (err) {
      setError('제출 파일 처리 오류: ' + err.message);
    }
  };

  // 사용자 유형 선택 화면
  const UserTypeSelection = () => (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl text-center space-y-6">
        <h1 className="text-3xl font-bold mb-6">데이터분석 경진대회</h1>
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => setUserType('participant')}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition"
          >
            참가자
          </button>
          <button
            onClick={() => setUserType('admin')}
            className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition"
          >
            관리자
          </button>
        </div>
      </div>
    </div>
  );

  // 관리자 로그인 화면
  const AdminLoginView = () => (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">관리자 로그인</h2>
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-600">사용자명</label>
            <input
              type="text"
              name="username"
              value={loginData.username}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="사용자명 입력"
              required
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-600">비밀번호</label>
            <input
              type="password"
              name="password"
              value={loginData.password}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="비밀번호 입력"
              required
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition duration-300"
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => setUserType(null)}
            className="w-full mt-2 bg-gray-500 text-white py-2 rounded-md hover:bg-gray-600 transition duration-300"
          >
            처음 화면으로
          </button>
        </form>
      </div>
    </div>
  );

  // 참가자 화면
  const ParticipantView = () => (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center">
      <div className="container mx-auto">
        <div className="bg-white shadow-md rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">참가자 리더보드</h2>

          {/* 제출 파일 업로드 */}
          <div className="mb-4 text-center">
            <label className="cursor-pointer inline-block bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
              제출 파일 업로드
              <input
                type="file"
                className="hidden"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (!groundTruth) {
                      setError('정답 파일이 설정되지 않았습니다. 관리자에게 문의하세요.');
                      return;
                    }

                    const reader = new FileReader();
                    reader.onload = (e) => processSubmission(e.target.result, file.name);
                    reader.readAsText(file);
                  }
                }}
              />
            </label>
            <p className="mt-2 text-sm text-gray-600">
              * CSV 파일을 업로드하세요 (파일명이 팀 이름으로 사용됩니다)
            </p>
            {error && (
              <div className="text-red-500 text-sm mt-2">{error}</div>
            )}
          </div>

          {/* 평가 지표 선택 */}
          <div className="flex justify-center mb-4">
            {Object.entries(METRICS).map(([key, metric]) => (
              <button
                key={key}
                onClick={() => {
                  setSelectedMetric(key);
                  localStorage.setItem('selectedMetric', key);
                }}
                className={`px-3 py-1 mx-1 rounded text-sm ${
                  selectedMetric === key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {metric.name}
              </button>
            ))}
          </div>

          {/* 리더보드 테이블 */}
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-4 text-left">순위</th>
                <th className="p-4 text-left">팀 이름</th>
                <th className="p-4 text-left">
                  점수 ({METRICS[selectedMetric].name})
                </th>
                <th className="p-4 text-left">제출 시간</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission, index) => (
                <tr
                  key={index}
                  className={`
                    border-b hover:bg-gray-50 transition-colors
                    ${index < 3 ? 'bg-blue-50' : ''}
                  `}
                >
                  <td className="p-4">
                    <span className={`
                      font-medium
                      ${index === 0 ? 'text-yellow-500' : ''}
                      ${index === 1 ? 'text-gray-500' : ''}
                      ${index === 2 ? 'text-amber-600' : ''}
                    `}>
                      {submission.rank}
                    </span>
                  </td>
                  <td className="p-4 font-medium">{submission.teamName}</td>
                  <td className="p-4">
                    {METRICS[selectedMetric].format(submission[selectedMetric])}
                  </td>
                  <td className="p-4 text-gray-600">{submission.submitTime}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 뒤로가기 버튼 */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setUserType(null)}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                          >
                            처음 화면으로
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                // 관리자 페이지
                const AdminView = () => (
                  <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
                    <div className="relative py-3 sm:max-w-4xl sm:mx-auto">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-300 to-blue-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
                      <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
                        <div className="max-w-md mx-auto">
                          <div className="flex justify-between items-center mb-6">
                            <h1 className="text-2xl font-bold text-center text-gray-800">
                              데이터분석 경진대회 관리
                            </h1>
                            <button
                              onClick={handleAdminLogout}
                              className="text-red-500 hover:text-red-700 font-medium"
                            >
                              로그아웃
                            </button>
                          </div>

                          {/* 정답 파일 업로드 */}
                          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
                            <h3 className="font-medium mb-2 text-yellow-800">정답 파일 업로드 (관리자 전용)</h3>
                            <label className="cursor-pointer inline-block bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">
                              정답 파일 선택
                              <input
                                type="file"
                                className="hidden"
                                accept=".csv"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (e) => processGroundTruth(e.target.result);
                                    reader.readAsText(file);
                                  }
                                }}
                              />
                            </label>
                            {groundTruth && (
                              <p className="mt-2 text-sm text-green-600">
                                ✓ 정답 파일 설정 완료 (샘플 수: {groundTruth.length})
                              </p>
                            )}
                          </div>

                          {/* 에러 메시지 */}
                          {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-4">
                              {error}
                            </div>
                          )}

                          {/* 평가 지표 선택 */}
                          <div className="bg-white p-4 rounded-lg border mb-4">
                            <h3 className="font-medium mb-2">평가 지표 선택</h3>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(METRICS).map(([key, metric]) => (
                                <button
                                  key={key}
                                  onClick={() => {
                                    setSelectedMetric(key);
                                    localStorage.setItem('selectedMetric', key);
                                  }}
                                  className={`px-3 py-1 rounded text-sm ${
                                    selectedMetric === key
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200'
                                  }`}
                                >
                                  {metric.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 제출 파일 업로드 */}
                          <div className="bg-white p-4 rounded-lg border mb-4">
                            <h3 className="font-medium mb-2">팀 제출 파일 업로드</h3>
                            <label className="cursor-pointer inline-block bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                              제출 파일 선택
                              <input
                                type="file"
                                className="hidden"
                                accept=".csv"
                                multiple
                                onChange={(e) => {
                                  Array.from(e.target.files || []).forEach(file => {
                                    const reader = new FileReader();
                                    reader.onload = (e) => processSubmission(e.target.result, file.name);
                                    reader.readAsText(file);
                                  });
                                }}
                              />
                            </label>
                            <p className="mt-2 text-sm text-gray-600">
                              * 파일명이 팀 이름으로 사용됩니다 (예: TeamA.csv)
                            </p>
                          </div>

                          {/* 리더보드 테이블 */}
                          <div className="overflow-x-auto bg-white rounded-lg shadow">
                            <table className="w-full">
                              <thead className="bg-gray-100 border-b">
                                <tr>
                                  <th className="p-4 text-left">순위</th>
                                  <th className="p-4 text-left">팀 이름</th>
                                  <th className="p-4 text-left">
                                    점수 ({METRICS[selectedMetric].name})
                                  </th>
                                  <th className="p-4 text-left">제출 시간</th>
                                </tr>
                              </thead>
                              <tbody>
                                {submissions.map((submission, index) => (
                                  <tr
                                    key={index}
                                    className={`
                                      border-b hover:bg-gray-50 transition-colors
                                      ${index < 3 ? 'bg-blue-50' : ''}
                                    `}
                                  >
                                    <td className="p-4">
                                      <span className={`
                                        font-medium
                                        ${index === 0 ? 'text-yellow-500' : ''}
                                        ${index === 1 ? 'text-gray-500' : ''}
                                        ${index === 2 ? 'text-amber-600' : ''}
                                      `}>
                                        {submission.rank}
                                      </span>
                                    </td>
                                    <td className="p-4 font-medium">{submission.teamName}</td>
                                    <td className="p-4">
                                      {METRICS[selectedMetric].format(submission[selectedMetric])}
                                    </td>
                                    <td className="p-4 text-gray-600">{submission.submitTime}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                // 메인 렌더링 로직
                const renderContent = () => {
                  if (!userType) {
                    return <UserTypeSelection />;
                  }

                  if (userType === 'admin') {
                    if (!isAdmin) {
                      return <AdminLoginView />;
                    }
                    return <AdminView />;
                  }

                  if (userType === 'participant') {
                    return <ParticipantView />;
                  }
                };

                return (
                  <div>
                    {renderContent()}
                  </div>
                );
              };

              export default Leaderboard;
