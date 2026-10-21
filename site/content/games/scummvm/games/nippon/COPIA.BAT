CLS
ECHO OFF
echo  [*]---------- NIPPON SAFES INC INSTALL ------------[*]


copy %1arj.exe %2\nippon\arj.exe

%2\nippon\arj e %1disco1.arj  %2\nippon


:A2
echo *
echo * INSERT  DISK 2 INTO DRIVE A:
echo *
PAUSE
if exist %1disco2.arj goto ok2

CLS
echo * ERROR : THIS IS NOT  DISK 2
goto A2
:OK2

%2\nippon\arj e %1disco2.arj %2\nippon

CLS
:A3
echo *
echo * INSERT  DISK 3 INTO DRIVE A:
echo *
PAUSE
if exist %1disco3.arj goto ok3

CLS
echo ERROR : THIS IS NOT DISK 3
goto A3
:OK3

%2\nippon\arj  e  %1disco3.arj %2\nippon



echo *
echo * INSTALLATION COMPLETED TYPE :
echo * cd nippon
echo * gioca

