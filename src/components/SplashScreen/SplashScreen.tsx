import React from 'react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';

type SplashScreenProps = {
	visible: boolean;
	onClose?: () => void;
};

export const SplashScreen: React.FC<SplashScreenProps> = ({ visible, onClose }) => {
	const { accentColor, theme } = useAppStore();
	const accentHex = getAccentHex(accentColor);
	
	if (!visible) return null;

	return (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center"
			style={{
				backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
				backdropFilter: 'blur(20px)',
				WebkitBackdropFilter: 'blur(20px)'
			}}
		>
			{/* Kiwi Logo and Name in top-left corner */}
			<div 
				className="absolute top-6 left-6 flex items-center gap-2"
				style={{ zIndex: 1 }}
			>
				<img src="/kiwi.png" alt="Kiwi" className="w-8 h-8" />
				<h1 
					className="text-xl font-semibold"
					style={{ color: theme === 'dark' ? '#e5e7eb' : '#374151' }}
				>
					Kiwi
				</h1>
			</div>
			
			<div className="flex items-center justify-center">
				<div className="spinner">
					<div></div>
					<div></div>
					<div></div>
					<div></div>
					<div></div>
					<div></div>
				</div>
			</div>
			<style>{`
			/* From Uiverse.io by AqFox - adapted with user theme */
			.spinner {
				width: 80px;
				height: 80px;
				animation: spinner-y0fdc1 2s infinite ease;
				transform-style: preserve-3d;
			}

			.spinner > div {
				background-color: ${accentHex}33;
				height: 100%;
				position: absolute;
				width: 100%;
				border: 2px solid ${accentHex};
			}

			.spinner div:nth-of-type(1) {
				transform: translateZ(-40px) rotateY(180deg);
			}

			.spinner div:nth-of-type(2) {
				transform: rotateY(-270deg) translateX(50%);
				transform-origin: top right;
			}

			.spinner div:nth-of-type(3) {
				transform: rotateY(270deg) translateX(-50%);
				transform-origin: center left;
			}

			.spinner div:nth-of-type(4) {
				transform: rotateX(90deg) translateY(-50%);
				transform-origin: top center;
			}

			.spinner div:nth-of-type(5) {
				transform: rotateX(-90deg) translateY(50%);
				transform-origin: bottom center;
			}

			.spinner div:nth-of-type(6) {
				transform: translateZ(40px);
			}

			@keyframes spinner-y0fdc1 {
				0% {
					transform: rotate(45deg) rotateX(-25deg) rotateY(25deg);
				}

				50% {
					transform: rotate(45deg) rotateX(-385deg) rotateY(25deg);
				}

				100% {
					transform: rotate(45deg) rotateX(-385deg) rotateY(385deg);
				}
			}
			`}</style>
		</div>
	);
};

export default SplashScreen;

